import React, { useState } from 'react';
import { Campaign, Submission, topUpCampaignBudget, clearSpikeFlag } from '../api';
import { Plus, TrendingUp, AlertTriangle, CheckCircle, ExternalLink, RefreshCw, Sparkles, ArrowUpRight, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

interface BrandDashboardProps {
  campaigns: Campaign[];
  submissions: Submission[];
  onRefresh: () => void;
  onOpenCreateCampaign: () => void;
  brandUserId?: string;
}

export const BrandDashboard: React.FC<BrandDashboardProps> = ({
  campaigns,
  submissions,
  onRefresh,
  onOpenCreateCampaign,
  brandUserId,
}) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    campaigns.length > 0 ? campaigns[0]._id : null
  );
  const [topUpModalCampaign, setTopUpModalCampaign] = useState<Campaign | null>(null);
  const [additionalBudget, setAdditionalBudget] = useState<number>(5000);
  const [isToppingUp, setIsToppingUp] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [subSearch, setSubSearch] = useState('');

  const myCampaigns = brandUserId
    ? campaigns.filter((c) => c.brandId === brandUserId)
    : campaigns;

  const totalAllocated = myCampaigns.reduce((acc, c) => acc + c.totalBudget, 0);
  const totalSpent = myCampaigns.reduce((acc, c) => acc + c.spentBudget, 0);
  const totalRemaining = myCampaigns.reduce((acc, c) => acc + (c.remainingBudget ?? (c.totalBudget - c.spentBudget)), 0);
  const totalWithheld = myCampaigns.reduce((acc, c) => acc + (c.withheldBudget || 0), 0);

  const selectedCampaign = campaigns.find((c) => c._id === selectedCampaignId) || campaigns[0];
  const campaignSubmissions = selectedCampaign
    ? submissions.filter((s) => s.campaignId === selectedCampaign._id)
    : [];

  const filteredSubs = campaignSubmissions.filter((s) => {
    if (!subSearch) return true;
    return (
      (s.creatorName && s.creatorName.toLowerCase().includes(subSearch.toLowerCase())) ||
      s.postUrl.toLowerCase().includes(subSearch.toLowerCase())
    );
  });

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topUpModalCampaign) return;
    setIsToppingUp(true);
    setStatusMessage(null);
    try {
      const res = await topUpCampaignBudget(topUpModalCampaign._id, additionalBudget);
      setStatusMessage(
        `Added ₹${additionalBudget.toLocaleString()}. Released ₹${res.releasedPayouts.toLocaleString()} across ${res.unlockedCount} withheld submissions!`
      );
      if (res.releasedPayouts > 0) {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
      setTopUpModalCampaign(null);
      onRefresh();
    } catch (err: any) {
      setStatusMessage('Top-up failed: ' + err.message);
    } finally {
      setIsToppingUp(false);
    }
  };

  const handleClearSpike = async (subId: string) => {
    try {
      await clearSpikeFlag(subId);
      setStatusMessage('View spike anomaly flag cleared.');
      onRefresh();
    } catch (err: any) {
      alert('Failed to clear spike flag: ' + err.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              Brand Control Panel
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Campaign Operations & Budgets</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time milestone budget tracking, creator disbursements, and automated cap enforcement.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onRefresh}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors cursor-pointer shadow-2xs"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenCreateCampaign}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-all shadow-sm hover:shadow cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Launch Campaign</span>
          </button>
        </div>
      </div>

      {/* Alert toast if statusMessage exists */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{statusMessage}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold cursor-pointer ml-3"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pastel KPI Financial Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Allocated Budget */}
        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-2xl p-5 border border-purple-200/70 bg-gradient-to-br from-purple-50/80 via-white to-purple-50/40 shadow-xs"
        >
          <div className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider font-mono">
            Total Allocated
          </div>
          <div className="text-2xl font-extrabold font-mono text-slate-900 mt-1 tabular-nums">
            ₹{totalAllocated.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">{myCampaigns.length} campaigns live</div>
        </motion.div>

        {/* Spent / Disbursed */}
        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-2xl p-5 border border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/40 shadow-xs"
        >
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider font-mono">
            Spent (Disbursed)
          </div>
          <div className="text-2xl font-extrabold font-mono text-emerald-800 mt-1 tabular-nums">
            ₹{totalSpent.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-700/80 font-medium mt-1">
            {totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0}% utilization rate
          </div>
        </motion.div>

        {/* Remaining Budget */}
        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-2xl p-5 border border-sky-200/70 bg-gradient-to-br from-sky-50/80 via-white to-sky-50/40 shadow-xs"
        >
          <div className="text-[11px] font-semibold text-sky-700 uppercase tracking-wider font-mono">
            Remaining Budget
          </div>
          <div className="text-2xl font-extrabold font-mono text-slate-900 mt-1 tabular-nums">
            ₹{totalRemaining.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Safe for upcoming tiers</div>
        </motion.div>

        {/* Withheld Amount */}
        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-2xl p-5 border border-amber-200/70 bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40 shadow-xs"
        >
          <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider font-mono">
            Withheld (Budget-Cap)
          </div>
          <div className="text-2xl font-extrabold font-mono text-amber-800 mt-1 tabular-nums">
            ₹{totalWithheld.toLocaleString()}
          </div>
          <div className="text-[11px] text-amber-700/80 font-medium mt-1">
            {totalWithheld > 0 ? 'Top up to unlock payouts' : 'Zero withheld claims'}
          </div>
        </motion.div>
      </div>

      {/* Campaigns List & Detail Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Campaigns Selectable List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-sm font-bold text-slate-800">Your Campaigns</h2>
            <span className="text-xs text-slate-400 font-mono">{myCampaigns.length} campaigns</span>
          </div>

          {myCampaigns.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <p className="text-xs text-slate-500">No campaigns launched yet.</p>
              <button
                onClick={onOpenCreateCampaign}
                className="mt-2 text-xs text-purple-700 font-semibold hover:underline cursor-pointer"
              >
                Launch your first campaign →
              </button>
            </div>
          ) : (
            myCampaigns.map((camp) => {
              const remaining = camp.remainingBudget ?? (camp.totalBudget - camp.spentBudget);
              const percent = camp.totalBudget > 0 ? Math.min(100, Math.round((camp.spentBudget / camp.totalBudget) * 100)) : 0;
              const isSelected = selectedCampaign?._id === camp._id;

              return (
                <div
                  key={camp._id}
                  onClick={() => setSelectedCampaignId(camp._id)}
                  className={`p-4.5 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-purple-50/70 border-purple-300/90 shadow-xs ring-2 ring-purple-200/50'
                      : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{camp.name}</div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 font-medium">
                        <span>{camp.platform}</span>
                        <span aria-hidden="true">·</span>
                        <span>{camp.milestones.length} Milestones</span>
                        <span aria-hidden="true">·</span>
                        <span>{camp.submissionCount || 0} Submissions</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      {camp.status}
                    </span>
                  </div>

                  {/* Budget Progress Bar */}
                  <div className="mt-3.5 pt-3 border-t border-slate-200/60">
                    <div className="flex items-center justify-between text-xs font-mono mb-1.5 tabular-nums">
                      <span className="text-slate-600">
                        Spent: <strong className="text-emerald-700">₹{camp.spentBudget.toLocaleString()}</strong>
                      </span>
                      <span className="text-slate-500">
                        Budget: <strong className="text-slate-800">₹{camp.totalBudget.toLocaleString()}</strong>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 font-mono">
                      <span>{percent}% spent</span>
                      <span className="font-semibold text-slate-700">Rem: ₹{remaining.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Selected Campaign Deep Dive (7 cols) */}
        <div className="lg:col-span-7">
          {selectedCampaign ? (
            <div className="pastel-card rounded-2xl p-6 space-y-6">
              {/* Campaign Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="text-[11px] font-mono font-semibold text-purple-700 uppercase tracking-wider">
                    {selectedCampaign.platform} Campaign
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">{selectedCampaign.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setTopUpModalCampaign(selectedCampaign);
                      setAdditionalBudget(5000);
                    }}
                    className="px-3.5 py-2 text-xs font-bold text-slate-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl transition-all cursor-pointer shadow-2xs"
                  >
                    + Top Up Budget
                  </button>
                </div>
              </div>

              {/* Milestone Ladder Display */}
              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 font-mono">
                  Milestone Ladder Configuration
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {selectedCampaign.milestones.map((m, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-3.5 text-center shadow-2xs"
                    >
                      <div className="text-[10px] text-slate-400 uppercase font-mono font-semibold">
                        Tier #{idx + 1}
                      </div>
                      <div className="text-sm font-extrabold text-slate-900 font-mono mt-0.5 tabular-nums">
                        {m.viewThreshold.toLocaleString()} views
                      </div>
                      <div className="text-xs font-bold text-emerald-700 font-mono mt-1 tabular-nums bg-emerald-50 rounded-md py-0.5 border border-emerald-200/60">
                        Payout: ₹{m.payout.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submissions Section */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Creator Submissions ({campaignSubmissions.length})
                  </h4>

                  {campaignSubmissions.length > 0 && (
                    <div className="relative w-48">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search posts..."
                        value={subSearch}
                        onChange={(e) => setSubSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-purple-300"
                      />
                    </div>
                  )}
                </div>

                {filteredSubs.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50/80 border border-slate-200/80 rounded-xl text-xs text-slate-500">
                    No submissions found for this campaign. Creators can submit post links from the Creator Hub.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {filteredSubs.map((sub) => {
                      return (
                        <div
                          key={sub._id}
                          className="bg-white border border-slate-200/90 rounded-xl p-4 space-y-2.5 shadow-2xs hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-xs font-bold text-slate-900">
                                {sub.creatorName || 'Creator'}
                              </div>
                              <a
                                href={sub.postUrl}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="text-xs text-purple-700 hover:underline flex items-center gap-1 font-mono mt-0.5 truncate max-w-sm"
                              >
                                <span>{sub.postUrl}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            </div>

                            {/* Status tags */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {sub.flaggedForSpike && (
                                <span className="text-[10px] font-bold bg-rose-50 border border-rose-200 text-rose-700 px-2.5 py-0.5 rounded-full font-mono">
                                  Spike Flagged
                                </span>
                              )}
                              {sub.payoutStatus === 'paid' && (
                                <span className="text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-0.5 rounded-full font-mono">
                                  Paid
                                </span>
                              )}
                              {sub.payoutStatus === 'withheld_budget_capped' && (
                                <span className="text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-0.5 rounded-full font-mono">
                                  Withheld (Cap)
                                </span>
                              )}
                              {sub.payoutStatus === 'none' && (
                                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-mono">
                                  In Progress
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Stats Row */}
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-xs font-mono tabular-nums">
                            <div>
                              <span className="text-slate-400 block text-[10px]">Verified Views</span>
                              <span className="text-slate-900 font-bold">{sub.currentViews.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Total Paid</span>
                              <span className="text-emerald-700 font-bold">₹{sub.totalPayoutReceived.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Withheld Amount</span>
                              <span className={sub.withheldPayout > 0 ? 'text-amber-700 font-bold' : 'text-slate-400'}>
                                ₹{(sub.withheldPayout || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Spike alert banner if flagged */}
                          {sub.flaggedForSpike && (
                            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-1.5 text-rose-800">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                                <span className="font-medium">{sub.spikeReason || 'Unusual view surge detected'}</span>
                              </div>
                              <button
                                onClick={() => handleClearSpike(sub._id)}
                                className="px-2.5 py-1 bg-white hover:bg-rose-100 border border-rose-200 text-rose-800 text-[11px] font-semibold rounded-md transition-colors shrink-0 cursor-pointer"
                              >
                                Clear Flag
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
              Select a campaign from the left to view details.
            </div>
          )}
        </div>
      </div>

      {/* Top Up Modal */}
      <AnimatePresence>
        {topUpModalCampaign && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md w-full shadow-2xl relative"
            >
              <h3 className="text-lg font-bold text-slate-900">Top Up Campaign Budget</h3>
              <p className="text-xs text-slate-500 mt-1">
                Add funds to <strong className="text-slate-800">{topUpModalCampaign.name}</strong>. Any creator milestone payouts currently withheld due to budget cap will automatically be disbursed.
              </p>

              <form onSubmit={handleTopUpSubmit} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Additional Budget Amount (INR ₹)
                  </label>
                  <input
                    type="number"
                    min="500"
                    step="500"
                    required
                    value={additionalBudget}
                    onChange={(e) => setAdditionalBudget(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-mono font-bold focus:outline-none focus:border-purple-400 focus:bg-white"
                  />
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs font-mono space-y-1.5">
                  <div className="flex justify-between text-slate-500">
                    <span>Current Total Budget:</span>
                    <span>₹{topUpModalCampaign.totalBudget.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-emerald-800 font-bold">
                    <span>New Total Budget:</span>
                    <span>₹{(topUpModalCampaign.totalBudget + additionalBudget).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setTopUpModalCampaign(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isToppingUp}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isToppingUp ? 'Topping up...' : 'Confirm Top-Up'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
