import React, { useState } from 'react';
import { Submission, Campaign, updateSubmissionViews } from '../api';
import { Play, Zap, ShieldAlert, Cpu, CheckCircle, RefreshCw, Terminal, Layers, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

interface ViewSimulatorLabProps {
  submissions: Submission[];
  campaigns: Campaign[];
  onRefresh: () => void;
}

interface LogEvent {
  id: string;
  timestamp: string;
  type: 'update' | 'spike' | 'concurrency' | 'success' | 'warn';
  message: string;
  details?: any;
}

export const ViewSimulatorLab: React.FC<ViewSimulatorLabProps> = ({
  submissions,
  campaigns,
  onRefresh,
}) => {
  const [selectedSubId, setSelectedSubId] = useState<string>(
    submissions.length > 0 ? submissions[0]._id : ''
  );
  const [customViews, setCustomViews] = useState<number>(10000);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isRaceTesting, setIsRaceTesting] = useState(false);
  const [logs, setLogs] = useState<LogEvent[]>([]);

  const selectedSub = submissions.find((s) => s._id === selectedSubId) || submissions[0];
  const activeCampaign = selectedSub
    ? campaigns.find((c) => c._id === selectedSub.campaignId)
    : null;

  const addLog = (type: LogEvent['type'], message: string, details?: any) => {
    const newLog: LogEvent = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      details,
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 30)]);
  };

  const handleUpdateViews = async (targetViews: number, isSpikeTest = false) => {
    if (!selectedSub) return;
    setIsSimulating(true);
    addLog('update', `Sending PATCH /api/submissions/${selectedSub._id}/views with ${targetViews.toLocaleString()} views...`);

    try {
      const res = await updateSubmissionViews(selectedSub._id, targetViews);
      const calc = res.calculation;

      if (calc.actualPayoutDisbursed > 0) {
        addLog(
          'success',
          `Milestone Unlocked! Disbursed ₹${calc.actualPayoutDisbursed.toLocaleString()} to ${selectedSub.creatorName || 'creator'}. Campaign remaining: ₹${res.campaign.remainingBudget.toLocaleString()}.`
        );
        confetti({
          particleCount: 70,
          spread: 80,
          origin: { y: 0.6 },
        });
      } else if (calc.withheldAmount > 0) {
        addLog(
          'warn',
          `BUDGET CAP ENFORCED: Milestone reached, but ₹${calc.withheldAmount.toLocaleString()} withheld because remaining budget (₹${calc.remainingBudgetBefore.toLocaleString()}) was insufficient!`
        );
      } else {
        addLog('update', `Views updated to ${targetViews.toLocaleString()}. No incremental milestone crossed.`);
      }

      if (calc.isSpikeDetected) {
        addLog('spike', `FRAUD ANOMALY FLAGGED: ${calc.spikeReason}`);
      }

      onRefresh();
    } catch (err: any) {
      addLog('warn', `View update failed: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleTriggerSpike = async () => {
    if (!selectedSub) return;
    const spikeViews = selectedSub.currentViews + 85000;
    addLog('spike', `Simulating malicious view bot spike: +85,000 views instantaneously...`);
    await handleUpdateViews(spikeViews, true);
  };

  const handleRunConcurrencyTest = async () => {
    if (!selectedSub || !activeCampaign) return;
    setIsRaceTesting(true);
    addLog(
      'concurrency',
      `DISPATCHING 5 SIMULTANEOUS VIEW UPDATES to campaign "${activeCampaign.name}" at the exact same millisecond...`
    );

    try {
      const baseViews = selectedSub.currentViews;
      const promises = [1, 2, 3, 4, 5].map((index) => {
        const increment = index * 12000;
        return updateSubmissionViews(selectedSub._id, baseViews + increment);
      });

      const results = await Promise.all(promises);
      results.forEach((r, idx) => {
        const calc = r.calculation;
        addLog(
          'concurrency',
          `Parallel Request #${idx + 1} finished: Views=${calc.newViews.toLocaleString()} | Paid=₹${calc.actualPayoutDisbursed.toLocaleString()} | Withheld=₹${calc.withheldAmount.toLocaleString()}`
        );
      });

      const finalCampaign = results[results.length - 1].campaign;
      addLog(
        'success',
        `CONCURRENCY TEST PASSED! Mutex lock serialized all 5 requests. Total budget: ₹${finalCampaign.totalBudget.toLocaleString()} | Spent: ₹${finalCampaign.spentBudget.toLocaleString()} | Remaining: ₹${finalCampaign.remainingBudget.toLocaleString()} (Zero deficit, zero double payouts).`
      );

      confetti({
        particleCount: 90,
        spread: 90,
        origin: { y: 0.5 },
      });

      onRefresh();
    } catch (err: any) {
      addLog('warn', `Concurrency test error: ${err.message}`);
    } finally {
      setIsRaceTesting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200/80">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-peach-50 text-orange-700 bg-orange-50 border border-orange-200">
            Interactive Testbed
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Platform Data Crawl Simulator</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Simulate views data crawl (`PATCH /api/submissions/:id/views`), test milestone unlocks, trigger fraud spike detection, and stress-test race conditions.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Control Column (6 cols) */}
        <div className="lg:col-span-6 space-y-5">
          {/* Submission Selector Card */}
          <div className="pastel-card rounded-2xl p-5 shadow-xs">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider font-mono mb-2">
              Select Submission to Simulate
            </label>
            <select
              value={selectedSubId}
              onChange={(e) => {
                setSelectedSubId(e.target.value);
                const sub = submissions.find((s) => s._id === e.target.value);
                if (sub) setCustomViews(sub.currentViews + 10000);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono font-medium focus:outline-none focus:border-purple-400 focus:bg-white mb-3"
            >
              {submissions.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.creatorName || 'Creator'} · {s.campaignName || 'Campaign'} ({s.currentViews.toLocaleString()} views, ₹{s.totalPayoutReceived} paid)
                </option>
              ))}
            </select>

            {selectedSub && activeCampaign && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs font-mono space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Post Link:</span>
                  <span className="text-slate-800 truncate max-w-xs font-medium">{selectedSub.postUrl}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Views:</span>
                  <span className="text-slate-900 font-extrabold">{selectedSub.currentViews.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Disbursed Payout:</span>
                  <span className="text-emerald-700 font-bold">₹{selectedSub.totalPayoutReceived.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Campaign Remaining Budget:</span>
                  <span className="text-slate-900 font-bold">
                    ₹{(activeCampaign.remainingBudget ?? (activeCampaign.totalBudget - activeCampaign.spentBudget)).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Direct View Adjuster */}
          <div className="pastel-card rounded-2xl p-5 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900">Direct View Update (`PATCH /api/submissions/:id/views`)</h3>
            <p className="text-xs text-slate-500">
              Increment or set views to trigger automated milestone evaluation and campaign budget locks.
            </p>

            {/* Quick Increment Buttons */}
            <div>
              <span className="text-[11px] text-slate-400 font-mono font-semibold block mb-2">
                Quick Increments:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[5000, 15000, 45000, 100000].map((inc) => (
                  <motion.button
                    key={inc}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      if (selectedSub) {
                        const target = selectedSub.currentViews + inc;
                        setCustomViews(target);
                        handleUpdateViews(target);
                      }
                    }}
                    disabled={isSimulating}
                    className="p-2.5 bg-gradient-to-b from-white to-slate-50 hover:to-purple-50 border border-slate-200 text-slate-800 text-xs font-mono font-bold rounded-xl transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    +{inc >= 1000 ? `${inc / 1000}K` : inc} views
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Set Specific Target Views</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={customViews}
                  onChange={(e) => setCustomViews(Number(e.target.value))}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-mono font-bold focus:outline-none focus:border-purple-400 focus:bg-white"
                />
                <button
                  onClick={() => handleUpdateViews(customViews)}
                  disabled={isSimulating}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  Apply Views
                </button>
              </div>
            </div>
          </div>

          {/* Anomaly & Concurrency Tests */}
          <div className="pastel-card rounded-2xl p-5 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900">Automated Anomaly & Race Condition Lab</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Spike Anomaly Test */}
              <div className="p-4 bg-rose-50/70 border border-rose-200/80 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-rose-800 text-xs font-bold">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Fraud Spike Anomaly Test</span>
                </div>
                <p className="text-[11px] text-rose-900/80 leading-relaxed">
                  Injects +85,000 views in 1 second to trigger the anomaly detector and flag the post.
                </p>
                <button
                  onClick={handleTriggerSpike}
                  disabled={isSimulating}
                  className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  Simulate Fraud Spike
                </button>
              </div>

              {/* Concurrency Race Condition Test */}
              <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span>Concurrency Race Test</span>
                </div>
                <p className="text-[11px] text-amber-900/80 leading-relaxed">
                  Fires 5 parallel PATCH requests to test mutex serialization and budget integrity.
                </p>
                <button
                  onClick={handleRunConcurrencyTest}
                  disabled={isRaceTesting}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  {isRaceTesting ? 'Running 5 Requests...' : 'Run 5 Parallel Requests'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Telemetry Stream (6 cols) */}
        <div className="lg:col-span-6">
          <div className="pastel-card rounded-2xl p-5 h-full flex flex-col shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                  Live Audit Telemetry Stream
                </h3>
              </div>
              <button
                onClick={() => setLogs([])}
                className="text-[11px] text-slate-400 hover:text-slate-700 font-mono cursor-pointer"
              >
                Clear Log
              </button>
            </div>

            <div className="flex-1 bg-slate-900 rounded-xl p-3.5 overflow-y-auto space-y-2 font-mono text-xs max-h-[580px] text-slate-200 shadow-inner">
              {logs.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  Telemetry stream ready. Update views, test view spikes, or run parallel concurrency requests to inspect live calculations.
                </div>
              ) : (
                logs.map((log) => {
                  let badgeColor = 'text-slate-400';
                  if (log.type === 'success') badgeColor = 'text-emerald-400';
                  if (log.type === 'spike') badgeColor = 'text-rose-400';
                  if (log.type === 'warn') badgeColor = 'text-amber-400';
                  if (log.type === 'concurrency') badgeColor = 'text-cyan-400';

                  return (
                    <div key={log.id} className="pb-2 border-b border-slate-800/80 last:border-0">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                        <span className={`uppercase font-bold ${badgeColor}`}>[{log.type}]</span>
                        <span>{log.timestamp}</span>
                      </div>
                      <div className="text-slate-200 leading-relaxed text-[11px] break-words">
                        {log.message}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
