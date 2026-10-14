import { IMilestone, IPayoutCalculationResult, ISubmission, ICampaign } from './types.js';

/**
 * Finds the highest milestone reached by the current view count.
 * Milestones must have { viewThreshold, payout }.
 */
export function getHighestMilestone(views: number, milestones: IMilestone[]): IMilestone | null {
  if (!milestones || milestones.length === 0) return null;
  const sorted = [...milestones].sort((a, b) => a.viewThreshold - b.viewThreshold);
  let highest: IMilestone | null = null;
  for (const m of sorted) {
    if (views >= m.viewThreshold) {
      highest = m;
    }
  }
  return highest;
}

/**
 * Finds the next milestone to be reached after the current view count.
 */
export function getNextMilestone(views: number, milestones: IMilestone[]): IMilestone | null {
  if (!milestones || milestones.length === 0) return null;
  const sorted = [...milestones].sort((a, b) => a.viewThreshold - b.viewThreshold);
  for (const m of sorted) {
    if (views < m.viewThreshold) {
      return m;
    }
  }
  return null;
}

/**
 * Detects whether view count velocity indicates a suspicious automated spike.
 */
export function detectViewSpike(
  previousViews: number,
  newViews: number,
  lastUpdatedAt: Date,
  now: Date = new Date()
): { isSpike: boolean; reason?: string } {
  const deltaViews = newViews - previousViews;
  if (deltaViews <= 0) return { isSpike: false };

  const deltaSeconds = Math.max(1, (now.getTime() - new Date(lastUpdatedAt).getTime()) / 1000);
  const velocityPerSecond = deltaViews / deltaSeconds;

  // Rule 1: Massive absolute jump in a short window (>50,000 views in under 120 seconds)
  if (deltaViews >= 50000 && deltaSeconds <= 120) {
    return {
      isSpike: true,
      reason: `Unusual view jump: +${deltaViews.toLocaleString()} views within ${Math.round(deltaSeconds)}s (~${Math.round(velocityPerSecond)} views/sec).`,
    };
  }

  // Rule 2: Unrealistic velocity (>800 views/sec for additions > 20,000 views)
  if (deltaViews >= 20000 && velocityPerSecond > 800) {
    return {
      isSpike: true,
      reason: `Extreme view velocity detected: ${Math.round(velocityPerSecond)} views/sec.`,
    };
  }

  // Rule 3: 20x instantaneous multiplier when previousViews > 1000 and delta > 25000
  if (previousViews >= 1000 && newViews >= previousViews * 20 && deltaViews >= 25000) {
    return {
      isSpike: true,
      reason: `Sudden exponential view multiplier (${(newViews / previousViews).toFixed(1)}x) detected.`,
    };
  }

  return { isSpike: false };
}

/**
 * Core Payout Calculation Logic.
 * 
 * Rules:
 * 1. Payout target is the payout value of the highest milestone crossed.
 * 2. Incremental payout needed = max(0, milestonePayoutTarget - currentTotalPayoutReceived).
 * 3. Total payouts must never exceed the campaign's remaining budget.
 * 4. Per policy: if incremental payout > remainingBudget, withhold milestone payout completely
 *    until budget is increased.
 */
export function calculatePayout(params: {
  newViews: number;
  previousViews: number;
  currentTotalPayoutReceived: number;
  milestones: IMilestone[];
  remainingBudget: number;
  lastUpdatedAt: Date;
  now?: Date;
}): IPayoutCalculationResult {
  const {
    newViews,
    previousViews,
    currentTotalPayoutReceived,
    milestones,
    remainingBudget,
    lastUpdatedAt,
    now = new Date(),
  } = params;

  // View count cannot be negative; if lower than previous, keep previous
  const effectiveViews = Math.max(0, newViews);
  const highestMilestone = getHighestMilestone(effectiveViews, milestones);

  const highestMilestoneThreshold = highestMilestone ? highestMilestone.viewThreshold : 0;
  const milestonePayoutTarget = highestMilestone ? highestMilestone.payout : 0;

  // Incremental payout needed to bring creator to the highest milestone target
  const incrementalPayoutNeeded = Math.max(0, milestonePayoutTarget - currentTotalPayoutReceived);

  // Fraud spike evaluation
  const spikeCheck = detectViewSpike(previousViews, effectiveViews, lastUpdatedAt, now);

  let actualPayoutDisbursed = 0;
  let withheldAmount = 0;
  let isBudgetExceeded = false;
  let payoutStatus: 'none' | 'paid' | 'withheld_budget_capped' = 'none';

  if (incrementalPayoutNeeded === 0) {
    // No new payout required (either no milestone crossed or already fully paid)
    actualPayoutDisbursed = 0;
    withheldAmount = 0;
    payoutStatus = 'none';
  } else {
    // Check campaign budget constraint
    if (remainingBudget >= incrementalPayoutNeeded) {
      // Full payout can be safely disbursed
      actualPayoutDisbursed = incrementalPayoutNeeded;
      withheldAmount = 0;
      payoutStatus = 'paid';
    } else {
      // Remaining budget is insufficient for this milestone tier!
      // In accordance with product policy: withhold milestone payout completely until budget is added
      actualPayoutDisbursed = 0;
      withheldAmount = incrementalPayoutNeeded;
      isBudgetExceeded = true;
      payoutStatus = 'withheld_budget_capped';
    }
  }

  const remainingBudgetAfter = Math.max(0, remainingBudget - actualPayoutDisbursed);

  return {
    previousViews,
    newViews: effectiveViews,
    highestMilestoneThreshold,
    milestonePayoutTarget,
    incrementalPayoutNeeded,
    actualPayoutDisbursed,
    withheldAmount,
    remainingBudgetBefore: remainingBudget,
    remainingBudgetAfter,
    isBudgetExceeded,
    payoutStatus,
    isSpikeDetected: spikeCheck.isSpike,
    spikeReason: spikeCheck.reason,
  };
}
