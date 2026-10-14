import { Router, Request, Response } from 'express';
import { db } from '../db/models.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { calculatePayout } from '../payoutEngine.js';
import { campaignMutex } from '../mutex.js';
import { cache } from '../cache/redis.js';

const router = Router();

// GET /api/submissions - Query submissions (can filter by campaignId, creatorId, etc.)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { campaignId, creatorId } = req.query;

    let submissions = await db.submissions.getAll();

    if (campaignId && typeof campaignId === 'string') {
      submissions = submissions.filter((s) => s.campaignId === campaignId);
    }
    if (creatorId && typeof creatorId === 'string') {
      submissions = submissions.filter((s) => s.creatorId === creatorId);
    }

    // Enrich with campaign details for UI
    const campaigns = await db.campaigns.getAll();
    const campMap = new Map(campaigns.map((c) => [c._id, c]));

    const enriched = submissions.map((s) => {
      const camp = campMap.get(s.campaignId);
      return {
        ...s,
        campaignName: camp?.name || 'Unknown Campaign',
        platform: camp?.platform || 'Instagram',
        campaignRemainingBudget: camp ? Math.max(0, camp.totalBudget - camp.spentBudget) : 0,
      };
    });

    return res.json(enriched);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch submissions: ' + err.message });
  }
});

// GET /api/submissions/creator/earnings - Summary of earnings for logged-in creator
router.get('/creator/earnings', requireAuth, requireRole('creator'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const creatorId = req.user!.userId;
    const subs = await db.submissions.findByCreatorId(creatorId);

    const totalPaid = subs.reduce((sum, s) => sum + (s.totalPayoutReceived || 0), 0);
    const totalWithheld = subs.reduce((sum, s) => sum + (s.withheldPayout || 0), 0);
    const totalViews = subs.reduce((sum, s) => sum + (s.currentViews || 0), 0);

    return res.json({
      creatorId,
      creatorName: req.user!.name,
      totalSubmissions: subs.length,
      totalViews,
      totalEarningsPaid: totalPaid,
      totalEarningsWithheld: totalWithheld,
      submissions: subs,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to calculate earnings: ' + err.message });
  }
});

// GET /api/submissions/:id - Single submission
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const sub = await db.submissions.findById(req.params.id);
    if (!sub) {
      return res.status(404).json({ error: 'Submission not found.' });
    }
    const camp = await db.campaigns.findById(sub.campaignId);
    return res.json({
      ...sub,
      campaign: camp,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch submission: ' + err.message });
  }
});

// POST /api/submissions - Submit post link to an active campaign (Creator only)
router.post('/', requireAuth, requireRole('creator'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { campaignId, postUrl } = req.body;

    if (!campaignId || !postUrl) {
      return res.status(400).json({ error: 'campaignId and postUrl are required.' });
    }

    const campaign = await db.campaigns.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign does not exist.' });
    }

    if (campaign.status !== 'active') {
      return res.status(400).json({ error: 'This campaign is no longer active.' });
    }

    // Basic URL format validation
    const trimmedUrl = postUrl.trim();
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      return res.status(400).json({ error: 'Post link must be a valid HTTP/HTTPS URL.' });
    }

    const submission = await db.submissions.create({
      campaignId,
      creatorId: req.user!.userId,
      creatorName: req.user!.name,
      postUrl: trimmedUrl,
    });

    // Invalidate campaign cache
    await cache.del('cache:campaigns:all');

    return res.status(201).json({
      message: 'Post submitted successfully.',
      submission,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to submit post: ' + err.message });
  }
});

/**
 * PATCH /api/submissions/:id/views
 * Updates a post's view count (simulates platform data).
 * NO ROLE CHECK NEEDED per prompt specifications!
 * 
 * Guarantees:
 * 1. Highest milestone reached payout calculation.
 * 2. Strict budget cap enforcement (campaign never overspends).
 * 3. Withholding policy when budget is insufficient.
 * 4. Concurrency race protection via campaign-level mutex lock.
 * 5. Idempotency (repeated updates with same view count disburse 0).
 * 6. Fraud detection for abnormal view spikes.
 */
router.patch('/:id/views', async (req: Request, res: Response) => {
  try {
    const { views } = req.body;
    const newViews = Number(views);

    if (isNaN(newViews) || newViews < 0) {
      return res.status(400).json({ error: 'views must be a non-negative number.' });
    }

    const submissionId = req.params.id;
    const initialSub = await db.submissions.findById(submissionId);

    if (!initialSub) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    const campaignId = initialSub.campaignId;

    // Execute within campaign-level atomic lock to guarantee concurrency safety
    const outcome = await campaignMutex.runExclusive(campaignId, async () => {
      // Re-read latest submission and campaign state under lock
      const sub = await db.submissions.findById(submissionId);
      const camp = await db.campaigns.findById(campaignId);

      if (!sub || !camp) {
        throw new Error('Submission or Campaign record missing under lock');
      }

      const remainingBudget = Math.max(0, camp.totalBudget - camp.spentBudget);

      // Perform core payout and fraud spike calculation
      const calculation = calculatePayout({
        newViews,
        previousViews: sub.currentViews,
        currentTotalPayoutReceived: sub.totalPayoutReceived,
        milestones: camp.milestones,
        remainingBudget,
        lastUpdatedAt: sub.lastViewUpdatedAt,
        now: new Date(),
      });

      // Prepare updated submission fields
      const newTotalPaid = sub.totalPayoutReceived + calculation.actualPayoutDisbursed;
      const newWithheld = calculation.withheldAmount;
      const isSpike = sub.flaggedForSpike || calculation.isSpikeDetected;
      const spikeReason = sub.spikeReason || calculation.spikeReason;

      let historyNote = '';
      if (calculation.actualPayoutDisbursed > 0) {
        historyNote = `Reached ${calculation.highestMilestoneThreshold.toLocaleString()} views milestone. Paid ₹${calculation.actualPayoutDisbursed.toLocaleString()}.`;
      } else if (calculation.withheldAmount > 0) {
        historyNote = `Reached ${calculation.highestMilestoneThreshold.toLocaleString()} views milestone, but campaign budget remaining (₹${remainingBudget.toLocaleString()}) was insufficient. Payout of ₹${calculation.withheldAmount.toLocaleString()} withheld until brand increases budget.`;
      } else if (newViews === sub.currentViews) {
        historyNote = `Views re-verified (${newViews.toLocaleString()} views). No milestone change.`;
      } else {
        historyNote = `Views updated to ${newViews.toLocaleString()}.`;
      }

      if (calculation.isSpikeDetected) {
        historyNote += ` [SPIKE FLAGGED: ${calculation.spikeReason}]`;
      }

      const historyEntry = {
        views: calculation.newViews,
        deltaViews: Math.max(0, calculation.newViews - sub.currentViews),
        payoutDisbursed: calculation.actualPayoutDisbursed,
        cumulativePayout: newTotalPaid,
        withheldAmount: newWithheld,
        milestoneReached: calculation.highestMilestoneThreshold,
        timestamp: new Date(),
        note: historyNote,
      };

      // Atomic update of submission
      const updatedSub = await db.submissions.update(submissionId, {
        currentViews: calculation.newViews,
        previousViews: sub.currentViews,
        lastViewUpdatedAt: new Date(),
        highestMilestoneThreshold: calculation.highestMilestoneThreshold,
        totalPayoutReceived: newTotalPaid,
        withheldPayout: newWithheld,
        payoutStatus: calculation.payoutStatus,
        flaggedForSpike: isSpike,
        spikeReason,
        history: [...sub.history, historyEntry],
      });

      // Update campaign spent budget if a payout was disbursed
      let updatedCamp = camp;
      if (calculation.actualPayoutDisbursed > 0) {
        updatedCamp = await db.campaigns.update(campaignId, {
          spentBudget: camp.spentBudget + calculation.actualPayoutDisbursed,
        }) || camp;
        await cache.del('cache:campaigns:all');
      }

      return {
        calculation,
        submission: updatedSub,
        campaign: {
          ...updatedCamp,
          remainingBudget: Math.max(0, updatedCamp.totalBudget - updatedCamp.spentBudget),
        },
      };
    });

    return res.json({
      message: 'Views updated successfully.',
      ...outcome,
    });
  } catch (err: any) {
    console.error('View update error:', err);
    return res.status(500).json({ error: 'Failed to update views: ' + err.message });
  }
});

// POST /api/submissions/:id/resolve-flag - Brand can clear or review flagged spike
router.post('/:id/resolve-flag', requireAuth, requireRole('brand'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sub = await db.submissions.findById(req.params.id);
    if (!sub) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    const updated = await db.submissions.update(sub._id, {
      flaggedForSpike: false,
      spikeReason: undefined,
    });

    return res.json({
      message: 'View spike flag cleared successfully.',
      submission: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
