import { Router, Request, Response } from 'express';
import { db } from '../db/models.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { IMilestone } from '../types.js';
import { campaignMutex } from '../mutex.js';
import { calculatePayout } from '../payoutEngine.js';
import { cache } from '../cache/redis.js';

const router = Router();
export const CAMPAIGN_CACHE_KEY = 'cache:campaigns:all';

// GET /api/campaigns - List all campaigns with Redis caching
router.get('/', async (req: Request, res: Response) => {
  try {
    // 1. Check Redis Cache
    const cached = await cache.get<any[]>(CAMPAIGN_CACHE_KEY);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    // 2. Fetch from DB if cache miss
    const campaigns = await db.campaigns.getAll();
    const submissions = await db.submissions.getAll();

    // Enrich campaign with live submission count, actual remaining budget, and withheld amounts
    const enriched = campaigns.map((c) => {
      const campSubs = submissions.filter((s) => s.campaignId === c._id);
      const remainingBudget = Math.max(0, c.totalBudget - c.spentBudget);
      const withheldSum = campSubs.reduce((acc, s) => acc + (s.withheldPayout || 0), 0);
      const percentSpent = c.totalBudget > 0 ? Math.min(100, Math.round((c.spentBudget / c.totalBudget) * 100)) : 0;

      return {
        ...c,
        remainingBudget,
        withheldBudget: withheldSum,
        submissionCount: campSubs.length,
        percentSpent,
      };
    });

    // 3. Store in Redis with 60s TTL
    await cache.set(CAMPAIGN_CACHE_KEY, enriched, 60);

    res.setHeader('X-Cache', 'MISS');
    return res.json(enriched);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch campaigns: ' + err.message });
  }
});

// GET /api/campaigns/:id - Get single campaign with submissions
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const campaign = await db.campaigns.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    const subs = await db.submissions.findByCampaignId(campaign._id);
    const remainingBudget = Math.max(0, campaign.totalBudget - campaign.spentBudget);
    const withheldSum = subs.reduce((acc, s) => acc + (s.withheldPayout || 0), 0);

    return res.json({
      ...campaign,
      remainingBudget,
      withheldBudget: withheldSum,
      submissions: subs,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch campaign: ' + err.message });
  }
});

// POST /api/campaigns - Create a new campaign (Brand role required)
router.post('/', requireAuth, requireRole('brand'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, platform, totalBudget, milestones } = req.body;

    if (!name || !platform || totalBudget === undefined || !milestones) {
      return res.status(400).json({
        error: 'Campaign name, platform (Instagram / YouTube), totalBudget, and milestones ladder are required.',
      });
    }

    if (platform !== 'Instagram' && platform !== 'YouTube') {
      return res.status(400).json({ error: 'Platform must be either "Instagram" or "YouTube".' });
    }

    const parsedBudget = Number(totalBudget);
    if (isNaN(parsedBudget) || parsedBudget <= 0) {
      return res.status(400).json({ error: 'Total budget must be a positive number.' });
    }

    if (!Array.isArray(milestones) || milestones.length === 0) {
      return res.status(400).json({ error: 'At least one milestone ladder tier is required.' });
    }

    // Validate and clean milestones
    const sanitizedMilestones: IMilestone[] = [];
    for (const m of milestones) {
      const threshold = Number(m.viewThreshold);
      const payout = Number(m.payout);

      if (isNaN(threshold) || isNaN(payout) || threshold <= 0 || payout <= 0) {
        return res.status(400).json({
          error: 'Each milestone must have a positive viewThreshold and payout value.',
        });
      }
      sanitizedMilestones.push({ viewThreshold: threshold, payout });
    }

    // Sort ascending by threshold
    sanitizedMilestones.sort((a, b) => a.viewThreshold - b.viewThreshold);

    const newCampaign = await db.campaigns.create({
      brandId: req.user!.userId,
      brandName: req.user!.name,
      name: name.trim(),
      platform,
      totalBudget: parsedBudget,
      milestones: sanitizedMilestones,
      status: 'active',
    });

    // Invalidate Redis cache
    await cache.del(CAMPAIGN_CACHE_KEY);

    return res.status(201).json({
      message: 'Campaign created successfully.',
      campaign: newCampaign,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create campaign: ' + err.message });
  }
});

// PATCH /api/campaigns/:id/budget - Increase/top up campaign budget
// Automatically evaluates and disburses any withheld payouts that were budget-capped!
router.patch('/:id/budget', requireAuth, requireRole('brand'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { additionalBudget } = req.body;
    const addAmount = Number(additionalBudget);

    if (isNaN(addAmount) || addAmount <= 0) {
      return res.status(400).json({ error: 'Additional budget must be a positive number.' });
    }

    const campaignId = req.params.id;

    // Mutex lock to prevent concurrency conflicts while updating budget
    const result = await campaignMutex.runExclusive(campaignId, async () => {
      const campaign = await db.campaigns.findById(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      const newTotalBudget = campaign.totalBudget + addAmount;
      let newSpentBudget = campaign.spentBudget;

      // Check if any submissions have withheld payouts due to previous budget cap
      const subs = await db.submissions.findByCampaignId(campaignId);
      const unlockedSubs: string[] = [];

      for (const sub of subs) {
        if (sub.payoutStatus === 'withheld_budget_capped' && sub.withheldPayout > 0) {
          const currentRemaining = newTotalBudget - newSpentBudget;
          if (currentRemaining >= sub.withheldPayout) {
            // Disburse the withheld payout!
            const releasedAmount = sub.withheldPayout;
            newSpentBudget += releasedAmount;

            const updatedHistory = [
              ...sub.history,
              {
                views: sub.currentViews,
                deltaViews: 0,
                payoutDisbursed: releasedAmount,
                cumulativePayout: sub.totalPayoutReceived + releasedAmount,
                withheldAmount: 0,
                milestoneReached: sub.highestMilestoneThreshold,
                timestamp: new Date(),
                note: `Withheld payout of ₹${releasedAmount.toLocaleString()} released after budget increase.`,
              },
            ];

            await db.submissions.update(sub._id, {
              totalPayoutReceived: sub.totalPayoutReceived + releasedAmount,
              withheldPayout: 0,
              payoutStatus: 'paid',
              history: updatedHistory,
            });

            unlockedSubs.push(sub._id);
          }
        }
      }

      const updatedCampaign = await db.campaigns.update(campaignId, {
        totalBudget: newTotalBudget,
        spentBudget: newSpentBudget,
      });

      // Invalidate Redis cache
      await cache.del(CAMPAIGN_CACHE_KEY);

      return {
        campaign: updatedCampaign,
        unlockedCount: unlockedSubs.length,
        releasedPayouts: newSpentBudget - campaign.spentBudget,
      };
    });

    return res.json({
      message: `Budget topped up successfully by ₹${addAmount.toLocaleString()}.`,
      ...result,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
