export type UserRole = 'brand' | 'creator';

export interface IUser {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
}

export interface IMilestone {
  viewThreshold: number;
  payout: number;
}

export interface ICampaign {
  _id: string;
  brandId: string;
  brandName?: string;
  name: string;
  platform: 'Instagram' | 'YouTube';
  totalBudget: number;
  spentBudget: number;
  withheldBudget: number;
  milestones: IMilestone[];
  status: 'active' | 'completed' | 'paused';
  createdAt: Date;
  updatedAt: Date;
}

export interface IViewUpdateHistory {
  views: number;
  deltaViews: number;
  payoutDisbursed: number;
  cumulativePayout: number;
  withheldAmount: number;
  milestoneReached: number; // viewThreshold
  timestamp: Date;
  note?: string;
}

export interface ISubmission {
  _id: string;
  campaignId: string;
  creatorId: string;
  creatorName?: string;
  postUrl: string;
  currentViews: number;
  previousViews: number;
  lastViewUpdatedAt: Date;
  highestMilestoneThreshold: number;
  totalPayoutReceived: number;
  withheldPayout: number;
  payoutStatus: 'none' | 'paid' | 'withheld_budget_capped' | 'flagged';
  flaggedForSpike: boolean;
  spikeReason?: string;
  history: IViewUpdateHistory[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IPayoutCalculationResult {
  previousViews: number;
  newViews: number;
  highestMilestoneThreshold: number;
  milestonePayoutTarget: number;
  incrementalPayoutNeeded: number;
  actualPayoutDisbursed: number;
  withheldAmount: number;
  remainingBudgetBefore: number;
  remainingBudgetAfter: number;
  isBudgetExceeded: boolean;
  payoutStatus: 'none' | 'paid' | 'withheld_budget_capped';
  isSpikeDetected: boolean;
  spikeReason?: string;
}
