import React, { useState } from 'react';
import { Milestone, createCampaign, Campaign } from '../api';
import { X, Plus, Trash2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (campaign: Campaign) => void;
}

export const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<'Instagram' | 'YouTube'>('Instagram');
  const [totalBudget, setTotalBudget] = useState<number>(15000);
  const [milestones, setMilestones] = useState<Milestone[]>([
    { viewThreshold: 10000, payout: 500 },
    { viewThreshold: 50000, payout: 2000 },
    { viewThreshold: 100000, payout: 5000 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAddTier = () => {
    const lastTier = milestones[milestones.length - 1];
    const newThreshold = lastTier ? lastTier.viewThreshold * 2 : 10000;
    const newPayout = lastTier ? lastTier.payout * 2 : 500;
    setMilestones([...milestones, { viewThreshold: newThreshold, payout: newPayout }]);
  };

  const handleRemoveTier = (index: number) => {
    if (milestones.length <= 1) return;
    setMilestones(milestones.filter((_, idx) => idx !== index));
  };

  const handleUpdateMilestone = (index: number, field: keyof Milestone, value: number) => {
    const updated = [...milestones];
    updated[index] = { ...updated[index], [field]: value };
    setMilestones(updated);
  };

  const applyPreset = (presetName: string) => {
    if (presetName === 'standard') {
      setMilestones([
        { viewThreshold: 10000, payout: 500 },
        { viewThreshold: 50000, payout: 2000 },
        { viewThreshold: 100000, payout: 5000 },
      ]);
      setTotalBudget(15000);
    } else if (presetName === 'micro') {
      setMilestones([
        { viewThreshold: 5000, payout: 250 },
        { viewThreshold: 20000, payout: 800 },
        { viewThreshold: 50000, payout: 2000 },
      ]);
      setTotalBudget(8000);
    } else if (presetName === 'mega') {
      setMilestones([
        { viewThreshold: 50000, payout: 2500 },
        { viewThreshold: 200000, payout: 8000 },
        { viewThreshold: 500000, payout: 20000 },
      ]);
      setTotalBudget(50000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide a campaign name.');
      return;
    }

    if (totalBudget <= 0) {
      setError('Total budget must be greater than zero.');
      return;
    }

    const sorted = [...milestones].sort((a, b) => a.viewThreshold - b.viewThreshold);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].viewThreshold <= 0 || sorted[i].payout <= 0) {
        setError('All milestone thresholds and payouts must be positive numbers.');
        return;
      }
      if (i > 0 && sorted[i].payout <= sorted[i - 1].payout) {
        setError('Higher view milestones must have strictly higher payouts.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const camp = await createCampaign({
        name: name.trim(),
        platform,
        totalBudget,
        milestones: sorted,
      });
      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.6 },
      });
      onSuccess(camp);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl border border-slate-200 p-6 max-w-lg w-full shadow-2xl relative my-8"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-5">
          <div className="text-[11px] font-mono font-semibold text-purple-700 uppercase tracking-wider">
            Brand Marketing
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-0.5">Launch Brand Campaign</h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure platform, total budget cap, and your milestone view ladder.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Campaign Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monsoon Sneaker Drop 2026"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-purple-400 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-purple-400 focus:bg-white"
              >
                <option value="Instagram">Instagram Reels</option>
                <option value="YouTube">YouTube Shorts</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Total Budget (INR ₹)</label>
              <input
                type="number"
                min="1000"
                step="500"
                required
                value={totalBudget}
                onChange={(e) => setTotalBudget(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-mono font-bold focus:outline-none focus:border-purple-400 focus:bg-white"
              />
            </div>
          </div>

          {/* Ladder Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">Milestone Ladder Tiers</label>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                <span>Presets:</span>
                <button
                  type="button"
                  onClick={() => applyPreset('standard')}
                  className="text-purple-700 hover:underline font-semibold cursor-pointer"
                >
                  Standard
                </button>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => applyPreset('micro')}
                  className="text-purple-700 hover:underline font-semibold cursor-pointer"
                >
                  Micro
                </button>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => applyPreset('mega')}
                  className="text-purple-700 hover:underline font-semibold cursor-pointer"
                >
                  Mega
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {milestones.map((m, index) => (
                <div key={index} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="w-6 text-center text-xs font-mono font-bold text-slate-400">#{index + 1}</div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-slate-400 mb-0.5 font-medium">Views Threshold</label>
                    <input
                      type="number"
                      min="100"
                      step="1000"
                      value={m.viewThreshold}
                      onChange={(e) => handleUpdateMilestone(index, 'viewThreshold', Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-mono font-bold focus:outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-slate-400 mb-0.5 font-medium">Payout (₹)</label>
                    <input
                      type="number"
                      min="50"
                      step="100"
                      value={m.payout}
                      onChange={(e) => handleUpdateMilestone(index, 'payout', Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-emerald-700 font-mono font-bold focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveTier(index)}
                    disabled={milestones.length <= 1}
                    className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-20 transition-colors mt-3 cursor-pointer"
                    title="Remove Tier"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddTier}
              className="mt-2 text-xs text-purple-700 hover:text-purple-900 font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Milestone Tier
            </button>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Launching...' : 'Launch Campaign'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
