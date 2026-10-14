// API client for Meme'd Campaign Payout Tracker

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'brand' | 'creator';
}

export interface Milestone {
  viewThreshold: number;
  payout: number;
}

export interface Campaign {
  _id: string;
  brandId: string;
  brandName?: string;
  name: string;
  platform: 'Instagram' | 'YouTube';
  totalBudget: number;
  spentBudget: number;
  remainingBudget: number;
  withheldBudget: number;
  submissionCount?: number;
  percentSpent?: number;
  milestones: Milestone[];
  status: 'active' | 'completed' | 'paused';
  createdAt: string;
  updatedAt: string;
}

export interface ViewHistoryEntry {
  views: number;
  deltaViews: number;
  payoutDisbursed: number;
  cumulativePayout: number;
  withheldAmount: number;
  milestoneReached: number;
  timestamp: string;
  note?: string;
}

export interface Submission {
  _id: string;
  campaignId: string;
  campaignName?: string;
  platform?: 'Instagram' | 'YouTube';
  creatorId: string;
  creatorName?: string;
  postUrl: string;
  currentViews: number;
  previousViews: number;
  lastViewUpdatedAt: string;
  highestMilestoneThreshold: number;
  totalPayoutReceived: number;
  withheldPayout: number;
  payoutStatus: 'none' | 'paid' | 'withheld_budget_capped' | 'flagged';
  flaggedForSpike: boolean;
  spikeReason?: string;
  history: ViewHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatorEarningsSummary {
  creatorId: string;
  creatorName: string;
  totalSubmissions: number;
  totalViews: number;
  totalEarningsPaid: number;
  totalEarningsWithheld: number;
  submissions: Submission[];
}

export interface DatabaseStatus {
  mode: 'mongodb' | 'memory';
  isMongoConnected: boolean;
  hasMongoUriEnv: boolean;
  message?: string;
}

const TOKEN_KEY = 'memed_auth_token';

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
};

function getHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = authStorage.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchHealth(): Promise<{ status: string; db: DatabaseStatus; timestamp: string }> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchDemoUsers(): Promise<User[]> {
  const res = await fetch('/api/auth/demo-users');
  if (!res.ok) throw new Error('Failed to load demo users');
  return res.json();
}

export async function loginUser(email: string, password: string):Promise<{ token: string; user: User }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  authStorage.setToken(data.token);
  return data;
}

export async function signupUser(name: string, email: string, password: string, role: 'brand' | 'creator'): Promise<{ token: string; user: User }> {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, role }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Signup failed');
  authStorage.setToken(data.token);
  return data;
}

export async function fetchCurrentUser(): Promise<User | null> {
  const token = authStorage.getToken();
  if (!token) return null;
  const res = await fetch('/api/auth/me', {
    headers: getHeaders(),
  });
  if (!res.ok) {
    authStorage.clearToken();
    return null;
  }
  return res.json();
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  const res = await fetch('/api/campaigns', { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to load campaigns');
  return res.json();
}

export async function createCampaign(payload: {
  name: string;
  platform: 'Instagram' | 'YouTube';
  totalBudget: number;
  milestones: Milestone[];
}): Promise<Campaign> {
  const res = await fetch('/api/campaigns', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create campaign');
  return data.campaign;
}

export async function topUpCampaignBudget(campaignId: string, additionalBudget: number): Promise<{ campaign: Campaign; releasedPayouts: number; unlockedCount: number }> {
  const res = await fetch(`/api/campaigns/${campaignId}/budget`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ additionalBudget }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to top up budget');
  return data;
}

export async function fetchSubmissions(campaignId?: string, creatorId?: string): Promise<Submission[]> {
  const params = new URLSearchParams();
  if (campaignId) params.append('campaignId', campaignId);
  if (creatorId) params.append('creatorId', creatorId);
  const res = await fetch(`/api/submissions?${params.toString()}`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to load submissions');
  return res.json();
}

export async function fetchCreatorEarnings(): Promise<CreatorEarningsSummary> {
  const res = await fetch('/api/submissions/creator/earnings', { headers: getHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load creator earnings');
  return data;
}

export async function submitPost(campaignId: string, postUrl: string): Promise<Submission> {
  const res = await fetch('/api/submissions', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ campaignId, postUrl }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to submit post');
  return data.submission;
}

/**
 * Update views on a submission.
 * Simulates third-party platform crawl. No role check needed.
 */
export async function updateSubmissionViews(submissionId: string, views: number): Promise<{
  submission: Submission;
  campaign: Campaign;
  calculation: any;
}> {
  const res = await fetch(`/api/submissions/${submissionId}/views`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ views }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update views');
  return data;
}

export async function clearSpikeFlag(submissionId: string): Promise<Submission> {
  const res = await fetch(`/api/submissions/${submissionId}/resolve-flag`, {
    method: 'POST',
    headers: getHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to clear spike flag');
  return data.submission;
}
