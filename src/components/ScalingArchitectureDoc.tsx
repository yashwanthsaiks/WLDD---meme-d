import React from 'react';
import { Server, Database, Lock, ShieldCheck, Zap, GitBranch, Cpu, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export const ScalingArchitectureDoc: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200/80">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            System Design Specification
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          How Meme’d Scales to 10,000 Creators & Millions of Views
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Engineering blueprint for sub-millisecond view crawling, distributed locks, and zero budget deficit.
        </p>
      </div>

      {/* Rationale & Stated Assumptions Callout */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/40 shadow-xs space-y-3"
      >
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Core Payout Invariants & Edge Case Resolution</span>
        </h2>
        <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed font-medium">
          <p>
            <strong className="text-slate-900">1. Post crosses multiple milestones in a single update:</strong>{' '}
            The creator’s target payout is evaluated at the highest milestone crossed. Incremental payout is calculated as <code className="text-purple-700 font-mono bg-purple-50 px-1 py-0.5 rounded border border-purple-200">max(0, highestMilestonePayout - totalAlreadyPaid)</code>. The creator receives the direct jump delta in full (no skipping or redundant stacking).
          </p>
          <p>
            <strong className="text-slate-900">2. Budget runs out mid-payout (Insufficient Budget):</strong>{' '}
            Milestone payouts exceeding remaining budget are <strong className="text-amber-700">withheld completely</strong> (<code className="text-amber-800 font-mono bg-amber-50 px-1 py-0.5 rounded border border-amber-200">withheld_budget_capped</code>) rather than causing negative balances. The campaign budget is strictly preserved. As soon as the brand increases the budget via <code className="text-slate-800 font-mono bg-slate-100 px-1 py-0.5 rounded">PATCH /api/campaigns/:id/budget</code>, the engine automatically evaluates and releases the withheld payouts.
          </p>
          <p>
            <strong className="text-slate-900">3. Concurrency & Repeated View Updates:</strong>{' '}
            Campaign-scoped mutex locking serializes simultaneous requests arriving at the same millisecond. Repeated view updates within the same milestone tier disburse ₹0 (strict idempotency).
          </p>
        </div>
      </motion.div>

      {/* Scaling to 10,000 Creators Blueprint */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Pillar 1: Ingestion */}
        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-2xl p-6 border border-emerald-200/70 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/20 shadow-xs space-y-3"
        >
          <div className="flex items-center gap-2 text-emerald-800 text-xs font-mono font-bold">
            <Zap className="w-4 h-4 text-emerald-600" />
            <span>1. Asynchronous Ingestion & Queuing</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            At 10,000 creators, view update polling produces 100+ writes/second. Instead of synchronous DB writes on every crawl:
          </p>
          <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
            <li>
              Route <code className="text-emerald-800 font-mono">PATCH /views</code> into an in-memory Redis stream or Kafka topic.
            </li>
            <li>
              Deduplicate high-frequency webhook ticks: only dispatch calculations if delta views exceed threshold (e.g. +500 views).
            </li>
            <li>
              Workers consume jobs with backpressure, avoiding database lock contention.
            </li>
          </ul>
        </motion.div>

        {/* Pillar 2: Distributed Locks */}
        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-2xl p-6 border border-sky-200/70 bg-gradient-to-br from-sky-50/50 via-white to-sky-50/20 shadow-xs space-y-3"
        >
          <div className="flex items-center gap-2 text-sky-800 text-xs font-mono font-bold">
            <Lock className="w-4 h-4 text-sky-600" />
            <span>2. Distributed Mutex via Redis Redlock</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            In multi-instance container deployments (Kubernetes / Cloud Run), Node.js in-process mutexes do not span multiple server replicas:
          </p>
          <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
            <li>
              Use <strong>Redis Redlock</strong> with key <code className="text-sky-800 font-mono">lock:campaign:&lbrace;id&rbrace;</code> with 2000ms TTL.
            </li>
            <li>
              Enforce atomic MongoDB conditional updates: <code className="text-slate-800 font-mono">&#123; $inc: &#123; spentBudget: delta &#125;, $lt: remaining &#125;</code>.
            </li>
            <li>
              Guarantees zero double-allocation across independent load-balanced worker pods.
            </li>
          </ul>
        </motion.div>

        {/* Pillar 3: Read Caching */}
        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-2xl p-6 border border-amber-200/70 bg-gradient-to-br from-amber-50/50 via-white to-amber-50/20 shadow-xs space-y-3"
        >
          <div className="flex items-center gap-2 text-amber-800 text-xs font-mono font-bold">
            <Cpu className="w-4 h-4 text-amber-600" />
            <span>3. Redis Campaign Read-Aside Cache</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            10,000 creators frequently refresh active campaign listings:
          </p>
          <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
            <li>
              Cache <code className="text-amber-800 font-mono">GET /api/campaigns</code> with a 30-second TTL.
            </li>
            <li>
              Invalidate cache key <code className="text-slate-800 font-mono">cache:campaigns:all</code> on campaign budget change or milestone top-up.
            </li>
            <li>
              Drops MongoDB read operations by &gt;95%, serving 10,000 concurrent creators with &lt;10ms p99 latency.
            </li>
          </ul>
        </motion.div>

        {/* Pillar 4: Sharding */}
        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-2xl p-6 border border-purple-200/70 bg-gradient-to-br from-purple-50/50 via-white to-purple-50/20 shadow-xs space-y-3"
        >
          <div className="flex items-center gap-2 text-purple-800 text-xs font-mono font-bold">
            <Database className="w-4 h-4 text-purple-600" />
            <span>4. Partitioning & Data Sharding</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Partition the <code className="text-slate-800 font-mono">submissions</code> collection by <code className="text-purple-800 font-mono">campaignId</code>:
          </p>
          <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
            <li>
              All submissions for a given campaign co-locate on the same shard chunk, ensuring localized query locks.
            </li>
            <li>
              Separate write-heavy historical view logs into a time-series collection or ClickHouse cold storage.
            </li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
};
