import React, { useState } from 'react';
import { Campaign, Submission } from '../api';
import { Instagram, Youtube, Sparkles, Search, ArrowRight, DollarSign, Eye, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CampaignsDirectoryProps {
  campaigns: Campaign[];
  submissions: Submission[];
  onSelectCampaignForSubmission: (campaignId: string) => void;
  onOpenCreateCampaign: () => void;
  isBrand: boolean;
}

export const CampaignsDirectory: React.FC<CampaignsDirectoryProps> = ({
  campaigns,
  submissions,
  onSelectCampaignForSubmission,
  onOpenCreateCampaign,
  isBrand,
}) => {
  const [platformFilter, setPlatformFilter] = useState<'all' | 'Instagram' | 'YouTube'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [calculatorCampaign, setCalculatorCampaign] = useState<Campaign | null>(null);
  const [calcViews, setCalcViews] = useState<number>(35000);

  const filtered = campaigns.filter((c) => {
    if (platformFilter !== 'all' && c.platform !== platformFilter) return false;
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Calculate earnings for calculator preview
  const getCalcReward = (camp: Campaign, views: number) => {
    const sorted = [...camp.milestones].sort((a, b) => a.viewThreshold - b.viewThreshold);
    let reward = 0;
    let reachedThreshold = 0;
    for (const m of sorted) {
      if (views >= m.viewThreshold) {
        reward = m.payout;
        reachedThreshold = m.viewThreshold;
      }
    }
    return { reward, reachedThreshold };
  };

  return (
    <div className="space-y-8">
      {/* Hero Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-100/90 via-pink-50/70 to-emerald-100/80 p-8 border border-purple-200/60 shadow-xs"
      >
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-purple-200 text-purple-700 text-xs font-semibold mb-3 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Marketplace Live & Automated</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Get Paid Automatically for Every Viral Milestone
          </h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Brands set the budget, you bring the viral content. Posts get verified and milestone payouts are awarded instantaneously with zero payment delays.
          </p>
        </div>

        {isBrand && (
          <div className="mt-5">
            <button
              onClick={onOpenCreateCampaign}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer"
            >
              + Launch Brand Campaign
            </button>
          </div>
        )}
      </motion.div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/80 backdrop-blur p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        {/* Segmented Filter */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/50">
          <button
            onClick={() => setPlatformFilter('all')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              platformFilter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Campaigns ({campaigns.length})
          </button>
          <button
            onClick={() => setPlatformFilter('Instagram')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              platformFilter === 'Instagram'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Instagram Reels
          </button>
          <button
            onClick={() => setPlatformFilter('YouTube')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              platformFilter === 'YouTube'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            YouTube Shorts
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search campaigns by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-400 focus:bg-white transition-all font-medium"
          />
        </div>
      </div>

      {/* Campaigns Grid */}
      {filtered.length === 0 ? (
        <div className="p-16 text-center bg-white/70 rounded-2xl border border-slate-200/70 shadow-2xs">
          <p className="text-sm font-semibold text-slate-700">No campaigns found matching your search.</p>
          <p className="text-xs text-slate-400 mt-1">Try resetting the platform filter or query.</p>
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filtered.map((camp, idx) => {
            const campSubs = submissions.filter((s) => s.campaignId === camp._id);
            const remaining = camp.remainingBudget ?? (camp.totalBudget - camp.spentBudget);
            const percentSpent = camp.totalBudget > 0 ? Math.min(100, Math.round((camp.spentBudget / camp.totalBudget) * 100)) : 0;
            const isInstagram = camp.platform === 'Instagram';

            return (
              <motion.div
                key={camp._id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                whileHover={{ y: -4 }}
                className="pastel-card rounded-2xl p-6 flex flex-col justify-between border border-slate-200/80 shadow-xs hover:shadow-md transition-all group"
              >
                <div>
                  {/* Top metadata & platform pill */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/60">
                        {camp.brandName || 'Brand'}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-2 leading-snug group-hover:text-purple-900 transition-colors">
                        {camp.name}
                      </h3>
                    </div>

                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0 flex items-center gap-1.5 ${
                        isInstagram
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {isInstagram ? 'Instagram' : 'YouTube'}
                    </span>
                  </div>

                  {/* Budget Tracker Progress */}
                  <div className="mt-4 p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/60">
                    <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                      <span className="text-slate-500">Remaining Budget:</span>
                      <span className="text-emerald-700 font-bold tabular-nums">₹{remaining.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentSpent}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 font-mono">
                      <span>{percentSpent}% Spent</span>
                      <span>Total: ₹{camp.totalBudget.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Milestone Ladder */}
                  <div className="mt-5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-2">
                      <span className="font-mono uppercase tracking-wider">Milestone Payout Ladder</span>
                      <button
                        onClick={() => {
                          setCalculatorCampaign(camp);
                          setCalcViews(30000);
                        }}
                        className="text-purple-600 hover:text-purple-800 underline font-mono text-[10px] cursor-pointer"
                      >
                        Calculator Preview ↗
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {camp.milestones.map((m, mIdx) => (
                        <div
                          key={mIdx}
                          className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100 text-xs font-mono shadow-2xs"
                        >
                          <span className="text-slate-700 font-medium">
                            {m.viewThreshold >= 1000
                              ? `${(m.viewThreshold / 1000).toLocaleString()}K views`
                              : `${m.viewThreshold} views`}
                          </span>
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                            ₹{m.payout.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card CTA Footer */}
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => onSelectCampaignForSubmission(camp._id)}
                    className="w-full py-2.5 px-4 bg-slate-900 hover:bg-emerald-600 text-white font-semibold text-xs rounded-xl transition-all shadow-xs hover:shadow flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Submit Post Link</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Interactive Milestone Calculator Modal */}
      <AnimatePresence>
        {calculatorCampaign && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md w-full shadow-2xl relative"
            >
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div>
                  <div className="text-[11px] font-mono font-semibold text-purple-700 uppercase">
                    Interactive Calculator
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">{calculatorCampaign.name}</h3>
                </div>
                <button
                  onClick={() => setCalculatorCampaign(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="py-5 space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>Simulate View Count</span>
                    <span className="font-mono text-purple-700 font-bold">{calcViews.toLocaleString()} views</span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max={calculatorCampaign.milestones[calculatorCampaign.milestones.length - 1]?.viewThreshold * 1.5 || 200000}
                    step="5000"
                    value={calcViews}
                    onChange={(e) => setCalcViews(Number(e.target.value))}
                    className="w-full accent-purple-600 cursor-pointer"
                  />
                </div>

                {(() => {
                  const res = getCalcReward(calculatorCampaign, calcViews);
                  return (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 text-center space-y-1">
                      <div className="text-xs text-slate-600">Calculated Creator Payout:</div>
                      <div className="text-3xl font-extrabold font-mono text-emerald-700 tabular-nums">
                        ₹{res.reward.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-emerald-800 font-medium">
                        {res.reachedThreshold > 0
                          ? `Crossed the ${res.reachedThreshold.toLocaleString()} views milestone tier!`
                          : 'Below first milestone threshold (earn ₹0 until threshold).'}
                      </div>
                    </div>
                  );
                })()}

                <button
                  onClick={() => {
                    onSelectCampaignForSubmission(calculatorCampaign._id);
                    setCalculatorCampaign(null);
                  }}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Join This Campaign →
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
