import React, { useState } from 'react';
import { Campaign, Submission, submitPost } from '../api';
import { ExternalLink, CheckCircle2, Clock, AlertCircle, Send, ArrowRight, Sparkles, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

interface CreatorDashboardProps {
  campaigns: Campaign[];
  submissions: Submission[];
  onRefresh: () => void;
  creatorUserId?: string;
}

export const CreatorDashboard: React.FC<CreatorDashboardProps> = ({
  campaigns,
  submissions,
  onRefresh,
  creatorUserId,
}) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(
    campaigns.length > 0 ? campaigns[0]._id : ''
  );
  const [postUrl, setPostUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mySubmissions = creatorUserId
    ? submissions.filter((s) => s.creatorId === creatorUserId)
    : submissions;

  const totalPaid = mySubmissions.reduce((sum, s) => sum + (s.totalPayoutReceived || 0), 0);
  const totalWithheld = mySubmissions.reduce((sum, s) => sum + (s.withheldPayout || 0), 0);
  const totalViews = mySubmissions.reduce((sum, s) => sum + (s.currentViews || 0), 0);

  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaignId || !postUrl.trim()) return;

    setIsSubmitting(true);
    setSubmitSuccess(null);
    setSubmitError(null);

    try {
      await submitPost(selectedCampaignId, postUrl.trim());
      setSubmitSuccess('Post submitted successfully! Now track its views and earn rewards.');
      setPostUrl('');
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });
      onRefresh();
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sampleLinks = [
    'https://www.instagram.com/reel/DAb821_MonsoonMeme',
    'https://www.youtube.com/shorts/kL929_SpeedCatViral',
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200/80">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Creator Dashboard
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Creator Earnings & Post Tracker</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Submit links to active brand campaigns, track view milestones in real time, and receive instant payouts.
        </p>
      </div>

      {/* Pastel KPI Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Disbursed */}
        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-2xl p-5 border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/50 shadow-xs"
        >
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider font-mono">
            Total Disbursed Earnings
          </div>
          <div className="text-3xl font-extrabold font-mono text-emerald-800 mt-1 tabular-nums">
            ₹{totalPaid.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-700/80 font-medium mt-1">Paid directly to creator balance</div>
        </motion.div>

        {/* Withheld Amount */}
        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-2xl p-5 border border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-white to-amber-50/50 shadow-xs"
        >
          <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider font-mono">
            Withheld (Budget-Cap)
          </div>
          <div className="text-3xl font-extrabold font-mono text-amber-800 mt-1 tabular-nums">
            ₹{totalWithheld.toLocaleString()}
          </div>
          <div className="text-[11px] text-amber-700/80 font-medium mt-1">
            {totalWithheld > 0 ? 'Unlocked as soon as brand tops up' : 'All milestone claims paid!'}
          </div>
        </motion.div>

        {/* Verified Views */}
        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-2xl p-5 border border-purple-200/80 bg-gradient-to-br from-purple-50/90 via-white to-purple-50/50 shadow-xs"
        >
          <div className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider font-mono">
            Total Verified Views
          </div>
          <div className="text-3xl font-extrabold font-mono text-slate-900 mt-1 tabular-nums">
            {totalViews.toLocaleString()}
          </div>
          <div className="text-[11px] text-purple-700/80 font-medium mt-1">Across {mySubmissions.length} submitted posts</div>
        </motion.div>
      </div>

      {/* Main 2-Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Submit New Post Form (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          <div className="pastel-card rounded-2xl p-6 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 mb-1">Submit New Post</h2>
            <p className="text-xs text-slate-500 mb-4">
              Enter your live Instagram Reel or YouTube Shorts URL.
            </p>

            <AnimatePresence>
              {submitSuccess && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium"
                >
                  {submitSuccess}
                </motion.div>
              )}
              {submitError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium"
                >
                  {submitError}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmitPost} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Campaign</label>
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium focus:outline-none focus:border-purple-400 focus:bg-white"
                >
                  {campaigns.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.platform})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Post Link URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://www.instagram.com/reel/..."
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-purple-400 focus:bg-white"
                />

                {/* Quick sample links for testing */}
                <div className="mt-2 flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400">
                  <span>Samples:</span>
                  {sampleLinks.map((link, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPostUrl(link)}
                      className="text-purple-600 hover:underline font-mono truncate max-w-[140px] cursor-pointer"
                    >
                      {link.split('/').pop()}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !selectedCampaignId}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Post'}</span>
              </button>
            </form>
          </div>

          {/* Quick Platform Ladder Preview */}
          {selectedCampaignId && (
            <div className="pastel-card rounded-2xl p-5 shadow-2xs">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono mb-2">
                Selected Milestone Ladder
              </div>
              {(() => {
                const active = campaigns.find((c) => c._id === selectedCampaignId);
                if (!active) return null;
                return (
                  <div className="space-y-2">
                    <div className="text-xs text-slate-500">
                      Campaign Budget Remaining:{' '}
                      <strong className="text-emerald-700 font-mono tabular-nums">
                        ₹{(active.remainingBudget ?? (active.totalBudget - active.spentBudget)).toLocaleString()}
                      </strong>
                    </div>
                    <div className="space-y-1.5 pt-1">
                      {active.milestones.map((m, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/70 font-mono"
                        >
                          <span className="text-slate-700">{m.viewThreshold.toLocaleString()} views</span>
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                            ₹{m.payout.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Right Column: Creator Submissions & Ladder Tracker (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-sm font-bold text-slate-800">My Submissions & Payout Status</h2>
            <span className="text-xs text-slate-400 font-mono">{mySubmissions.length} submissions</span>
          </div>

          {mySubmissions.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <p className="text-xs text-slate-500">You haven't submitted any posts yet.</p>
              <p className="text-xs text-slate-400 mt-1">
                Choose a campaign on the left and submit your Instagram or YouTube link.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {mySubmissions.map((sub) => {
                const campaign = campaigns.find((c) => c._id === sub.campaignId);
                const milestones = campaign?.milestones || [];
                const highestTier = milestones.find((m) => m.viewThreshold === sub.highestMilestoneThreshold);
                const nextTier = milestones.find((m) => m.viewThreshold > sub.currentViews);
                const viewsToNext = nextTier ? nextTier.viewThreshold - sub.currentViews : 0;

                return (
                  <motion.div
                    key={sub._id}
                    whileHover={{ y: -2 }}
                    className="pastel-card rounded-2xl p-5 space-y-4 shadow-xs"
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200/60">
                            {sub.platform || 'Instagram'}
                          </span>
                          <span className="text-xs text-slate-400" aria-hidden="true">·</span>
                          <span className="text-xs font-bold text-slate-800">{sub.campaignName}</span>
                        </div>
                        <a
                          href={sub.postUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-xs text-purple-700 hover:underline flex items-center gap-1.5 mt-1 font-mono truncate max-w-md"
                        >
                          <span>{sub.postUrl}</span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        </a>
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-2">
                        {sub.payoutStatus === 'paid' && (
                          <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Milestone Paid
                          </span>
                        )}
                        {sub.payoutStatus === 'withheld_budget_capped' && (
                          <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            Budget Capped (Withheld)
                          </span>
                        )}
                        {sub.payoutStatus === 'none' && (
                          <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            Tracking Views
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Numeric Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/90 p-4 rounded-xl border border-slate-200/70 text-xs font-mono tabular-nums">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Verified Views</span>
                        <span className="text-base font-extrabold text-slate-900">{sub.currentViews.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Highest Milestone</span>
                        <span className="text-base font-extrabold text-purple-800">
                          {sub.highestMilestoneThreshold > 0
                            ? `${(sub.highestMilestoneThreshold / 1000).toFixed(0)}K views`
                            : 'None yet'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Earnings Disbursed</span>
                        <span className="text-base font-extrabold text-emerald-700">
                          ₹{sub.totalPayoutReceived.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Withheld Amount</span>
                        <span className={`text-base font-extrabold ${sub.withheldPayout > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                          ₹{(sub.withheldPayout || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Visual Milestone Stepper */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-slate-600 font-semibold">Milestone Progression</span>
                        {nextTier ? (
                          <span className="text-slate-500 font-mono text-[11px]">
                            <strong className="text-purple-700 font-bold">{viewsToNext.toLocaleString()} views</strong> to next tier (+₹{(nextTier.payout - (highestTier?.payout || 0)).toLocaleString()})
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-mono font-bold text-[11px] flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            Top milestone tier completed!
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {milestones.map((m, idx) => {
                          const isReached = sub.currentViews >= m.viewThreshold;
                          return (
                            <div
                              key={idx}
                              className={`p-3 rounded-xl border text-xs transition-all ${
                                isReached
                                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900 shadow-2xs'
                                  : 'bg-white border-slate-200 text-slate-400'
                              }`}
                            >
                              <div className="flex items-center justify-between font-mono">
                                <span className="font-semibold">{m.viewThreshold.toLocaleString()} views</span>
                                {isReached ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <Clock className="w-4 h-4 text-slate-300" />
                                )}
                              </div>
                              <div className="mt-1 font-extrabold font-mono text-emerald-800">
                                ₹{m.payout.toLocaleString()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* View History Audit Log */}
                    {sub.history && sub.history.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <div className="text-[10px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">
                          Payout & Calculation Audit Timeline ({sub.history.length})
                        </div>
                        <div className="space-y-1.5 max-h-28 overflow-y-auto font-mono text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                          {sub.history.slice(-3).reverse().map((h, i) => (
                            <div key={i} className="flex items-center justify-between py-0.5 border-b border-slate-100 last:border-0">
                              <span>{h.note || `${h.views.toLocaleString()} views`}</span>
                              <span className="text-emerald-700 font-bold tabular-nums">
                                {h.payoutDisbursed > 0 ? `+₹${h.payoutDisbursed}` : '₹0'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
