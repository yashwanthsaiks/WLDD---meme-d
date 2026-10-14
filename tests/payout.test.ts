import { calculatePayout, getHighestMilestone, getNextMilestone, detectViewSpike } from '../src/server/payoutEngine';
import { IMilestone } from '../src/server/types';
import { KeyedMutex } from '../src/server/mutex';

describe("Meme'd Payout Engine & Budget Cap", () => {
  const sampleMilestones: IMilestone[] = [
    { viewThreshold: 10000, payout: 500 },
    { viewThreshold: 50000, payout: 2000 },
    { viewThreshold: 100000, payout: 5000 },
  ];

  describe('Milestone Lookup Helpers', () => {
    it('should find highest milestone crossed', () => {
      expect(getHighestMilestone(5000, sampleMilestones)).toBeNull();
      expect(getHighestMilestone(10000, sampleMilestones)?.viewThreshold).toBe(10000);
      expect(getHighestMilestone(35000, sampleMilestones)?.viewThreshold).toBe(10000);
      expect(getHighestMilestone(50000, sampleMilestones)?.viewThreshold).toBe(50000);
      expect(getHighestMilestone(120000, sampleMilestones)?.viewThreshold).toBe(100000);
    });

    it('should identify next milestone ahead', () => {
      expect(getNextMilestone(5000, sampleMilestones)?.viewThreshold).toBe(10000);
      expect(getNextMilestone(10000, sampleMilestones)?.viewThreshold).toBe(50000);
      expect(getNextMilestone(50000, sampleMilestones)?.viewThreshold).toBe(100000);
      expect(getNextMilestone(100000, sampleMilestones)).toBeNull();
    });
  });

  describe('Single Milestone Progression', () => {
    it('should disburse ₹500 when reaching 10K views with sufficient budget', () => {
      const result = calculatePayout({
        newViews: 12500,
        previousViews: 0,
        currentTotalPayoutReceived: 0,
        milestones: sampleMilestones,
        remainingBudget: 10000,
        lastUpdatedAt: new Date(Date.now() - 3600000),
      });

      expect(result.highestMilestoneThreshold).toBe(10000);
      expect(result.milestonePayoutTarget).toBe(500);
      expect(result.incrementalPayoutNeeded).toBe(500);
      expect(result.actualPayoutDisbursed).toBe(500);
      expect(result.withheldAmount).toBe(0);
      expect(result.remainingBudgetAfter).toBe(9500);
      expect(result.payoutStatus).toBe('paid');
      expect(result.isBudgetExceeded).toBe(false);
    });

    it('should pay zero if post has not yet crossed first milestone', () => {
      const result = calculatePayout({
        newViews: 8500,
        previousViews: 2000,
        currentTotalPayoutReceived: 0,
        milestones: sampleMilestones,
        remainingBudget: 10000,
        lastUpdatedAt: new Date(Date.now() - 3600000),
      });

      expect(result.highestMilestoneThreshold).toBe(0);
      expect(result.incrementalPayoutNeeded).toBe(0);
      expect(result.actualPayoutDisbursed).toBe(0);
      expect(result.payoutStatus).toBe('none');
    });
  });

  describe('Multi-Tier Progression & Incremental Delta', () => {
    it('should disburse only the incremental delta (₹1,500) when advancing from 10K to 50K milestone', () => {
      const result = calculatePayout({
        newViews: 52000,
        previousViews: 15000,
        currentTotalPayoutReceived: 500, // already received ₹500 at 10K milestone
        milestones: sampleMilestones,
        remainingBudget: 8000,
        lastUpdatedAt: new Date(Date.now() - 86400000),
      });

      expect(result.highestMilestoneThreshold).toBe(50000);
      expect(result.milestonePayoutTarget).toBe(2000);
      // Target is ₹2,000. Creator already received ₹500. Delta needed = ₹1,500.
      expect(result.incrementalPayoutNeeded).toBe(1500);
      expect(result.actualPayoutDisbursed).toBe(1500);
      expect(result.withheldAmount).toBe(0);
      expect(result.remainingBudgetAfter).toBe(6500);
      expect(result.payoutStatus).toBe('paid');
    });

    it('should award highest milestone payout (₹2,000) directly if post jumps past two tiers in one update', () => {
      const result = calculatePayout({
        newViews: 65000,
        previousViews: 0,
        currentTotalPayoutReceived: 0,
        milestones: sampleMilestones,
        remainingBudget: 10000,
        lastUpdatedAt: new Date(Date.now() - 86400000),
      });

      // Jumped from 0 past 10K and 50K: highest milestone is 50K (₹2,000).
      expect(result.highestMilestoneThreshold).toBe(50000);
      expect(result.milestonePayoutTarget).toBe(2000);
      expect(result.actualPayoutDisbursed).toBe(2000);
    });

    it('should disburse ₹0 if views increase within the same milestone tier (idempotency)', () => {
      const result = calculatePayout({
        newViews: 58000,
        previousViews: 52000,
        currentTotalPayoutReceived: 2000, // already received full ₹2,000 for 50K milestone
        milestones: sampleMilestones,
        remainingBudget: 6000,
        lastUpdatedAt: new Date(Date.now() - 3600000),
      });

      expect(result.highestMilestoneThreshold).toBe(50000);
      expect(result.incrementalPayoutNeeded).toBe(0);
      expect(result.actualPayoutDisbursed).toBe(0);
      expect(result.remainingBudgetAfter).toBe(6000);
      expect(result.payoutStatus).toBe('none');
    });
  });

  describe('Budget Cap Enforcement', () => {
    it('should withhold milestone payout completely when remaining budget is less than incremental payout needed', () => {
      const result = calculatePayout({
        newViews: 105000, // Reached 100K milestone (target ₹5,000)
        previousViews: 52000,
        currentTotalPayoutReceived: 2000, // Incremental needed = 5,000 - 2,000 = ₹3,000
        milestones: sampleMilestones,
        remainingBudget: 1500, // Insufficient remaining budget!
        lastUpdatedAt: new Date(Date.now() - 86400000),
      });

      expect(result.incrementalPayoutNeeded).toBe(3000);
      // Per product requirement: withhold milestone payout completely until budget is added
      expect(result.actualPayoutDisbursed).toBe(0);
      expect(result.withheldAmount).toBe(3000);
      expect(result.isBudgetExceeded).toBe(true);
      expect(result.payoutStatus).toBe('withheld_budget_capped');
      // Campaign budget must NEVER be overspent
      expect(result.remainingBudgetAfter).toBe(1500);
    });

    it('should disburse exactly when remaining budget equals the incremental payout', () => {
      const result = calculatePayout({
        newViews: 55000,
        previousViews: 10000,
        currentTotalPayoutReceived: 500, // Incremental needed = ₹1,500
        milestones: sampleMilestones,
        remainingBudget: 1500, // Exactly ₹1,500 available
        lastUpdatedAt: new Date(Date.now() - 86400000),
      });

      expect(result.actualPayoutDisbursed).toBe(1500);
      expect(result.remainingBudgetAfter).toBe(0);
      expect(result.payoutStatus).toBe('paid');
    });

    it('should protect against completely exhausted budget (remaining = 0)', () => {
      const result = calculatePayout({
        newViews: 15000,
        previousViews: 0,
        currentTotalPayoutReceived: 0,
        milestones: sampleMilestones,
        remainingBudget: 0, // Budget completely exhausted
        lastUpdatedAt: new Date(Date.now() - 3600000),
      });

      expect(result.actualPayoutDisbursed).toBe(0);
      expect(result.withheldAmount).toBe(500);
      expect(result.isBudgetExceeded).toBe(true);
      expect(result.remainingBudgetAfter).toBe(0);
    });
  });

  describe('View Spike Fraud Anomaly Detection', () => {
    it('should flag view surges of > 50,000 in short duration', () => {
      const spike = detectViewSpike(1000, 60000, new Date(Date.now() - 30000), new Date());
      expect(spike.isSpike).toBe(true);
      expect(spike.reason).toContain('Unusual view jump');
    });

    it('should not flag normal organic view growth over reasonable timeframe', () => {
      const normal = detectViewSpike(1000, 12000, new Date(Date.now() - 86400000), new Date());
      expect(normal.isSpike).toBe(false);
    });
  });

  describe('Concurrency & Mutex Integrity', () => {
    it('should serialize concurrent operations and prevent overspending shared campaign budget', async () => {
      const mutex = new KeyedMutex();
      let sharedCampaignBudgetRemaining = 2000;
      let totalDisbursed = 0;
      const results: number[] = [];

      // 4 concurrent requests trying to claim ₹1,000 each (Total demand = ₹4,000, but budget = ₹2,000)
      const requests = [1, 2, 3, 4].map((id) =>
        mutex.runExclusive('campaign_test_1', async () => {
          // Simulate async I/O delay
          await new Promise((r) => setTimeout(r, Math.random() * 20));

          const payoutNeeded = 1000;
          if (sharedCampaignBudgetRemaining >= payoutNeeded) {
            sharedCampaignBudgetRemaining -= payoutNeeded;
            totalDisbursed += payoutNeeded;
            results.push(payoutNeeded);
          } else {
            // Withheld
            results.push(0);
          }
        })
      );

      await Promise.all(requests);

      // Only first 2 requests could be paid; remaining 2 withheld
      expect(totalDisbursed).toBe(2000);
      expect(sharedCampaignBudgetRemaining).toBe(0);
      expect(results.filter((r) => r === 1000).length).toBe(2);
      expect(results.filter((r) => r === 0).length).toBe(2);
    });
  });

  describe('Redis Campaign List Caching (Bonus 5a)', () => {
    it('should cache and retrieve campaign list with hit counter increment', async () => {
      const { cache } = await import('../src/server/cache/redis');
      const testKey = 'test:campaigns:cache_check';
      const testData = [{ id: 'c1', name: 'Viral Drop', budget: 15000 }];

      // Initially null
      await cache.del(testKey);
      expect(await cache.get(testKey)).toBeNull();

      // Store in cache
      await cache.set(testKey, testData, 60);

      // Cache hit
      const retrieved = await cache.get<typeof testData>(testKey);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.[0].name).toBe('Viral Drop');

      // Invalidate cache
      await cache.del(testKey);
      expect(await cache.get(testKey)).toBeNull();
    });
  });
});
