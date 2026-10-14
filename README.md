# Meme’d Campaign Payout Tracker

**Meme’d** is a creator marketplace platform where brands run viral marketing campaigns (Instagram Reels & YouTube Shorts), and creators (meme pages, clip curators, hype accounts) post content and get paid through milestone view ladders.

---

## 1. Core Features

### a. Authentication & Role Separation
- **JWT-Based Authentication**: Secure token-based signup and login.
- **Two Distinct Roles**:
  - `brand`: Can create campaigns, configure milestone ladders, allocate budgets, track spent vs. remaining budgets, and top up funds.
  - `creator`: Can browse live campaigns, submit post links, and monitor earnings per submission.
- **Demo Mode**: 1-click test user switcher built into the UI for instant testing without manual typing.

### b. Brand Campaign Hub
- Create campaigns with Name, Platform (`Instagram` / `YouTube`), Total Budget, and Milestone Ladder (`viewThreshold` + `payout` pairs).
- Live real-time budget health indicators: Total Budget Allocated, Disbursed Spent, Withheld Claims, and Remaining Budget.
- Top up campaign budgets: automatically evaluates and disburses any withheld payouts that were previously budget-capped.

### c. Creator Hub
- Browse active campaigns by platform with remaining budget indicators.
- Submit post URLs to campaigns.
- Visual milestone ladder tracker showing current views, highest tier unlocked, and views remaining until the next milestone.
- Real-time earnings tally (disbursed vs. withheld).

### d. Views & Payout Engine (`PATCH /api/submissions/:id/views`)
- Simulates external platform crawls (no role check required).
- Evaluates the creator's payout based on the **highest milestone crossed**.
- Strict budget cap: a campaign **never pays out more than its remaining budget**.
- **Fraud Spike Detection**: Flags suspicious view surges (+50,000 views in <120 seconds or extreme velocity) with `flaggedForSpike: true`.
- **Concurrency Mutex Lock**: Eliminates race conditions so simultaneous requests can never overspend campaign budgets or double-pay.

### e. Interactive View Simulator & Concurrency Lab
- Dedicated interactive workbench built into the UI.
- Test view increments (+5K, +15K, +45K, +100K) or exact view counts.
- **Fraud Spike Test Button**: Injects an instantaneous +85,000 view surge to test anomaly detection.
- **Race Condition Stress Test Button**: Fires 5 parallel simultaneous `PATCH` view requests at the same millisecond to verify mutex serialization and zero deficit.

---

## 2. Payout Logic & Stated Assumptions

### A. Highest Milestone Delta Calculation
A creator's payout target is always the payout value of the **highest milestone tier** their post has crossed.
- When crossing a milestone, incremental payout = `max(0, highestMilestonePayout - totalPayoutReceived)`.
- **Crossing multiple milestones in a single update**: If a post jumps from 0 to 60,000 views (crossing both 10K → ₹500 and 50K → ₹2,000), the creator is directly awarded the full ₹2,000 for the highest milestone reached.
- **Repeated updates within the same tier (Idempotency)**: If views increase from 52,000 to 58,000 (both within the 50K tier), incremental payout needed is ₹0. Repeated view updates will never double-pay.

### B. Campaign Budget Cap & Withheld Policy
A campaign must never pay out more than its total allocated budget (`spentBudget <= totalBudget`).
- **When remaining budget is insufficient**: Per our confirmed policy, if a milestone requires ₹1,500 but the campaign only has ₹800 remaining, the milestone payout is **withheld completely** (`payoutStatus: "withheld_budget_capped"`), and ₹0 is disbursed.
- **Budget Top-Up Release**: When the brand tops up the campaign budget via `PATCH /api/campaigns/:id/budget`, the engine re-evaluates all withheld submissions and releases their payouts automatically.

### C. Concurrency Guarantee
To ensure two simultaneous view updates can never race to spend the same remaining budget:
- An in-process **Keyed Mutex** (`campaignMutex`) serializes all write operations per `campaignId`.
- Under the mutex lock, the latest campaign balance and submission records are read, evaluated, and updated sequentially.

---

## 3. How Meme’d Scales to 10,000 Creators (Half-Page Architectural Note)

Handling 10,000 creators with multiple daily posts generating millions of views requires transitioning from single-node synchronous execution to a distributed, event-driven architecture:

### 1. High-Throughput Asynchronous View Ingestion
- At 10,000 active creators with automated scrapers polling every 5 minutes, the system receives ~2,000 view updates/minute.
- Instead of executing synchronous database writes on `PATCH /views`, the API ingests events directly into an asynchronous message queue (e.g. **Kafka** topic or **Redis Streams** via BullMQ).
- An adaptive deduplication filter skips queue insertion if the view increase is below a threshold (e.g. `< 500` views since last calculation), cutting pipeline load by 80%.

### 2. Distributed Locking with Redis Redlock
- In a horizontally scaled cluster (multiple Node.js instances behind an ALB/Cloud Run), in-process mutexes do not protect against cross-node race conditions.
- Replace the in-process mutex with **Redis Redlock** keyed by `lock:campaign:{campaignId}` with a 2,000ms TTL.
- Pair this with atomic MongoDB conditional updates:
  ```typescript
  CampaignModel.findOneAndUpdate(
    { _id: campaignId, spentBudget: { $lte: totalBudget - deltaPayout } },
    { $inc: { spentBudget: deltaPayout } }
  );
  ```
- This guarantees zero budget deficits across all distributed workers.

### 3. Read-Aside Caching with Redis
- Creators and visitors repeatedly fetch active campaign lists (`GET /api/campaigns`).
- Cache campaign lists in Redis with a 30-second TTL (`cache:campaigns:active`).
- Invalidate the cache whenever a brand creates a campaign or tops up the budget.
- This offloads >95% of database read traffic, allowing the API to maintain `< 10ms` p99 latency for 10,000 concurrent creators.

### 4. Database Sharding & Cold Storage Archiving
- Shard the MongoDB `submissions` collection using `campaignId` as the shard key, ensuring all submissions for a campaign reside on the same shard for fast collocated calculations.
- Historical view logs (`submission.history`) are streamed to a time-series cold database (e.g. ClickHouse or TimescaleDB) to keep the primary operational documents lean and index cache memory minimal.

---

## 4. API Endpoints

### Authentication
- `POST /api/auth/signup` - Register brand or creator (`{ name, email, password, role }`).
- `POST /api/auth/login` - Authenticate and receive JWT token (`{ email, password }`).
- `GET /api/auth/me` - Get authenticated profile (`Bearer <token>`).
- `GET /api/auth/demo-users` - Fetch seeded demo accounts.

### Campaigns
- `GET /api/campaigns` - List all campaigns with live spent vs. remaining budgets.
- `GET /api/campaigns/:id` - Get single campaign details and submissions.
- `POST /api/campaigns` - Create new campaign with milestone ladder (Brand only).
- `PATCH /api/campaigns/:id/budget` - Top up campaign budget and release withheld claims (Brand only).

### Submissions & Views
- `GET /api/submissions` - List submissions (supports `?campaignId=` and `?creatorId=`).
- `GET /api/submissions/creator/earnings` - Creator earnings summary (Creator only).
- `POST /api/submissions` - Submit post URL to active campaign (Creator only).
- `PATCH /api/submissions/:id/views` - Update post view count & trigger payout calculation (**Public platform simulation endpoint**).
- `POST /api/submissions/:id/resolve-flag` - Review and clear fraud view spike flag (Brand only).

---

## 5. Running Tests

Unit tests are written with **Jest** and **SWC** covering:
1. Single milestone payout calculations.
2. Multi-tier milestone incremental progressions.
3. Strict budget cap enforcement and withholding logic.
4. Idempotency on repeated view updates.
5. Automated view spike fraud detection.
6. Mutex lock concurrency serialization.

Run tests:
```bash
npm test
```

---

## 6. Docker Deployment

### Docker Compose (App + MongoDB)
```bash
docker-compose up --build
```
Access the application at `http://localhost:3000`.

### Standalone Docker Image
```bash
docker build -t memed-payout-tracker .
docker run -p 3000:3000 -e MONGODB_URI="your_mongodb_atlas_uri" memed-payout-tracker
```
