# Meme'd Campaign Payout Tracker

A creator marketplace campaign payout engine and management platform for brands and creators, featuring milestone ladder view payouts, strict campaign budget caps, atomic concurrency guarantees, and real-time view simulation.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed based on your clarifications:

- **Confirmed Decision 1: Database Persistence Strategy**: The backend will support external MongoDB Atlas (`MONGODB_URI`), with a robust local fallback mechanism so the live preview works instantly out-of-the-box before external credentials are plugged in.
- **Confirmed Decision 2: Budget Cap Overrun Policy**: When a post crosses a higher milestone but the incremental payout exceeds the campaign's remaining budget, the milestone payout is **withheld completely** (flagged as `withheld_budget_capped`) until the brand increases the campaign budget, preventing any budget deficit.
- **Confirmed Decision 3: Interactive Simulator**: An integrated View Simulator and Concurrency Stress-Tester will be provided in the interface alongside Brand and Creator views to test race conditions, rapid view spikes (fraud detection), and milestone transitions in real time.

---

## 1. Overview & Core Concept

**Meme'd** connects brands running viral marketing campaigns on Instagram and YouTube with meme pages, clip curators, and hype accounts. 
- Brands set total campaign budgets and define **milestone ladders** (e.g. 10K views → ₹500, 50K views → ₹2,000, 100K views → ₹5,000).
- Creators post campaign content and submit their post links.
- Views are updated via `PATCH /api/submissions/:id/views`. A creator's payout is calculated as the payout of the highest milestone crossed minus previously disbursed amounts.
- Total payouts are strictly bounded: a campaign can never pay out more than its total allocated budget.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Authentication & Role Toggle**:
   - Clean JWT signup and login for **Brand** and **Creator** accounts.
   - Quick one-click demo persona switcher (e.g., "Demo Brand: HypeWear", "Demo Creator: @dankmemes") for rapid evaluation.
2. **Brand Portal**:
   - **Campaign Creator**: Intuitive milestone ladder builder (configurable view thresholds and payout in INR ₹) with budget allocation.
   - **Campaign Overview**: Visual budget health indicators (Total Budget, Disbursed Spent, Withheld/Pending, Remaining Budget) with progress tracks.
   - **Top-up Budget**: Brands can add budget to instantly unlock withheld milestone payouts.
3. **Creator Portal**:
   - **Live Campaign Directory**: Browse available campaigns by platform (Instagram Reels / YouTube Shorts) and inspect milestone ladders.
   - **Post Submission**: Submit post URL to active campaigns.
   - **Earnings Hub**: Total earnings metric (`₹` tabular figures), payout timeline per submission, and current milestone progress tier.
4. **Interactive View Simulator & Concurrency Lab**:
   - Real-time stepper/slider to simulate view count updates on any submission.
   - **Spike Fraud Trigger**: Simulates an unnatural 100K view surge to test the automated anomaly detection flag (`flaggedForSpike: true`).
   - **Concurrency Race Test**: Dispatches 5 concurrent view updates simultaneously to verify atomic lock execution and zero budget overspend.

### Visual Identity & Theme
- **Aesthetic Direction**: High-density modern SaaS dashboard tailored for creator-economy platforms. Clean slate surfaces, crisp hairline borders (`border-neutral-200 / border-neutral-800`), and zero-pill typography.
- **Color Palette**:
  - Canvas: `#0F172A` (deep dark slate) and `#F8FAFC` (subtle light mode support).
  - Primary Brand: Emerald green (`#10B981` / `#059669`) representing earnings and approved payouts.
  - Caution/Withheld: Amber (`#F59E0B`) for budget-capped milestones and flagged view anomalies.
  - Danger: Crimson (`#EF4444`) for budget exhaustion.
- **Typography**: Clean sans (`Plus Jakarta Sans` / modern system font) with monospace tabular numerals (`tabular-nums`) for currency amounts, view counters, and timestamps.

---

## 3. Key Product Decisions & Trade-Offs

- **Milestone Ladder Delta Calculation**:
  - *Chosen Approach*: Highest-milestone reached model. If post reaches Milestone 1 (10K views = ₹500), creator receives ₹500. When it later reaches Milestone 2 (50K views = ₹2,000), the creator receives the incremental ₹1,500 (total cumulative ₹2,000).
  - *Why*: Accurately reflects how creator tier contracts work without double-paying for earlier tiers.
- **Atomic Concurrency Protection**:
  - *Chosen Approach*: In-process async mutex lock per campaign ID combined with atomic database condition checks (`$inc` and budget guard checks).
  - *Why*: Eliminates race conditions when concurrent `PATCH` view requests arrive at the same millisecond.
- **Spike Detection Heuristic**:
  - *Chosen Approach*: Track `lastViewsUpdateAt` and `previousViews`. If view velocity exceeds $50,000$ views within 60 seconds (or jump ratio $> 500\%$), mark `flaggedForSpike: true` with reason and timestamp for brand audit.
  - *Why*: Protects brands against bot-inflated metrics before manual payout release.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 19 + Vite)               │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Brand View   │  │ Creator View │  │ View Simulator &  │  │
│  │ (Campaigns,  │  │ (Submissions,│  │ Concurrency Lab   │  │
│  │  Budgets)    │  │  Earnings)   │  │ (Audit Telemetry) │  │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬─────────┘  │
└─────────┼─────────────────┼────────────────────┼────────────┘
          │ (JWT Auth)      │ (Submissions)      │ (PATCH Views)
┌─────────▼─────────────────▼────────────────────▼────────────┐
│               Express + TypeScript API Server               │
│                                                             │
│  ┌──────────────────┐  ┌─────────────────────────────────┐  │
│  │   Auth Routes    │  │       Campaigns & Submissions   │  │
│  │ (/api/auth/*)    │  │       (/api/campaigns, etc.)    │  │
│  └──────────────────┘  └────────────────┬────────────────┘  │
│                                         │                   │
│                        ┌────────────────▼────────────────┐  │
│                        │ Payout Engine & Concurrency Lock│  │
│                        │ - Highest Milestone Delta       │  │
│                        │ - Budget Cap Guard              │  │
│                        │ - Fraud Velocity Detector       │  │
│                        └────────────────┬────────────────┘  │
└─────────────────────────────────────────┼───────────────────┘
                                          │
                                 ┌────────▼────────┐
                                 │ Mongoose / DB   │
                                 │ (Atlas / Memory)│
                                 └─────────────────┘
```

### Core Entities & Schemas
- **User**: `id`, `name`, `email`, `passwordHash`, `role` (`'brand' | 'creator'`).
- **Campaign**: `id`, `brandId`, `name`, `platform` (`'Instagram' | 'YouTube'`), `totalBudget`, `spentBudget`, `milestones: [{ viewThreshold: number, payout: number }]`, `status` (`'active' | 'completed'`).
- **Submission**: `id`, `campaignId`, `creatorId`, `postUrl`, `currentViews`, `highestMilestoneReached`, `totalPayoutReceived`, `withheldPayout`, `flaggedForSpike: boolean`, `spikeReason?: string`, `history: [{ views, payout, timestamp }]`.

### Unit Tests
- Jest unit test suite covering:
  1. Single milestone payout calculation.
  2. Multi-tier progression (incremental payout).
  3. Strict budget cap enforcement (withholding payouts when budget exhausted).
  4. Concurrent view update protection and idempotency.

---

## 5. Execution Steps

1. Install dependencies (`jsonwebtoken`, `bcryptjs`, `mongoose`, `jest`, `ts-jest`, `@types/jest`, `@types/jsonwebtoken`, `@types/bcryptjs`).
2. Implement backend models, payout calculation engine, and atomic campaign lock service.
3. Build Express server routes (`/api/auth`, `/api/campaigns`, `/api/submissions`, `PATCH /api/submissions/:id/views`).
4. Write Jest unit test suite in `tests/payout.test.ts` and verify with test runner.
5. Build rich, high-performance frontend interfaces for Brands, Creators, and the View Simulator.
6. Write `README.md` documenting architecture, assumptions, budget overrun rationale, and 10,000-creator scaling blueprint.
7. Compile and verify full applet build.
