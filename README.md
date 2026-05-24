# Prowider Mini Lead Distribution System - Developer Manual

Welcome to the **Prowider Mini Lead Distribution System**! This application is a concurrency-safe lead allocation and distribution system built with **Next.js 14 (App Router)**, **Prisma ORM**, **PostgreSQL**, and **Server-Sent Events (SSE)**.

It guarantees fair round-robin allocation among service providers, strictly enforces monthly quota limits, avoids double-allocation under concurrent traffic, and broadcasts lead generation real-time updates instantly to the connected dashboards.

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 1. COMPREHENSIVE DATABASE SETUP GUIDE
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To resolve the **"Failed to Connect"** message shown on the dashboard, you must connect a running PostgreSQL database. You can set this up using either **Option A (Local via Docker)** or **Option B (Cloud via Supabase)**.

---

### OPTION A: Local PostgreSQL Database (Using Docker)
This is the easiest and fastest way to get a local database running on your computer since Docker is already installed.

1. **Start Docker Desktop**: Ensure the Docker Desktop app is open and running on your machine.
2. **Launch the Container**: Open your terminal (PowerShell or command line) and run:
   ```bash
   docker run --name prowider-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=prowider_db -p 5432:5432 -d postgres
   ```
   *This downloads the official PostgreSQL image and starts a database server running on `localhost:5432` with username `postgres`, password `postgres`, and database `prowider_db`.*

3. **Verify the Container is Active**:
   ```bash
   docker ps
   ```
   *(You should see `prowider-postgres` listed as running).*

---

### OPTION B: Cloud PostgreSQL Database (Using Supabase - Free)
If you prefer not to use Docker, you can create a free, hosted database in the cloud.

1. **Sign Up**: Go to [Supabase](https://supabase.com) and sign in using your GitHub account.
2. **Create a Project**: Click **New Project**, select an organization, name your project `Prowider System`, and enter a secure database password.
3. **Get Your Connection String**:
   - Once the project is provisioned, go to **Project Settings** (gear icon) $\rightarrow$ **Database**.
   - Under **Connection string**, select the **URI** tab.
   - Copy the string. It will look like this:
     ```text
     postgresql://postgres.[your-project-id]:[your-password]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
     ```
4. **Update `.env`**: Paste your copied connection string into the `.env` file inside your project root as `DATABASE_URL` (make sure to replace `[your-password]` with the password you selected when creating the Supabase project).

---

### Initialize the Database (Push Schema & Seed)
Once either **Option A** or **Option B** is running and your `.env` contains your correct `DATABASE_URL`, execute these commands in your project root to prepare the database:

```bash
# 1. Push the database schema structure into PostgreSQL (creates all tables and constraints)
npx prisma db push

# 2. Seed the database with the initial 8 providers and 3 services
npx prisma db seed
```

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 2. SYSTEM ARCHITECTURE & CODE PARTS EXPLANATION
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Below is an in-depth breakdown of how the key files in `/lib`, `/app/api`, and `/prisma` work together to form the system.

### A. Prisma Client Connection Singleton (`/lib/prisma.ts`)
In Next.js development mode, hot-reloading frequently recreates the database connection pool, which can exhaust your database connection limits in minutes.
- **How it works**: This module creates a single, global-cached instance of `PrismaClient` and attaches it to Node’s `globalThis`. It checks if a client already exists on `globalThis` before instantiating a new one, keeping database connections stable during edits.

---

### B. Core Allocation Engine (`/lib/allocation.ts`)
This is the heart of the system. When a new service request is submitted, it is processed through an atomic transaction.

```mermaid
graph TD
    A[New Lead Request Received] --> B[Enter Prisma $transaction]
    B --> C[Execute raw SQL: SELECT ... FOR UPDATE]
    C --> D[Fetch Service & Rules]
    D --> E[Stage 1: Mandatory Provider Checks]
    E --> F{Has quota remaining?}
    F -- Yes --> G[Assign Mandatory Provider & Increment Month Leads]
    F -- No --> H[Skip Mandatory Provider]
    G --> I[Stage 2: Fair Pool Allocation]
    H --> I
    I --> J[Fetch Remaining Fair Pool Providers]
    J --> K[Sort Pool by allocationIndex ASC, then by ID ASC]
    K --> L[Select top eligible providers to fill remaining slots up to 3]
    L --> M[Increment Month Leads & Increment allocationIndex by 1]
    M --> N[Stage 3: Persist Lead & LeadAssignment Records]
    N --> O[Commit Transaction & Broadcast SSE Event]
```

#### Code Part Breakdown:
1. **Concurrency Lock**: To prevent race conditions, the transaction begins with a **SELECT FOR UPDATE** raw database query:
   ```typescript
   await tx.$queryRaw`SELECT id FROM "Provider" FOR UPDATE`;
   ```
   This locks the Provider rows. If 10 leads arrive at the exact same millisecond, they will queue up and execute sequentially, preventing two concurrent processes from getting out-of-sync or bypassing quota limits.
2. **Stage 1 (Mandatory Checks)**: Reads the service rules. Checks if the mandatory providers have remaining monthly quota (`monthlyQuota - currentMonthLeads > 0`). If eligible, they are added to the list and their lead counter is incremented.
3. **Stage 2 (Fair Pool Selection)**: If the mandatory assignments are less than 3, the system calculates the remaining slots needed. It retrieves the fair pool providers for the service, excluding any already assigned mandatory providers.
   - It sorts the pool by `allocationIndex` ascending (lowest index goes first, implementing the round-robin rotation).
   - It loops through the sorted providers, checks their quotas, assigns them, increments their `currentMonthLeads`, and increments their `allocationIndex` by 1 to move them to the back of the queue for the next lead.
4. **Stage 3 (Atomic Commit)**: The `Lead` and `LeadAssignment` records are created, committing all updates atomically. If anything fails (e.g. duplicate constraint violation), the entire database changes roll back automatically.

---

### C. Server-Sent Events (SSE) Broadcaster (`/lib/sse.ts`)
This singleton handles push updates to connected dashboards without requiring polling.
- **Client Registry**: Maintains a thread-safe global `Map` of active browser dashboard connections (`ReadableStreamDefaultController`).
- **Heartbeat Pings**: Runs an background timer that issues a ping event (`event: ping`) every 30 seconds to prevent reverse proxies (such as Nginx, Cloudflare, or Vercel) from closing idle connections due to inactivity.
- **Broadcast Handler**: When a lead is generated in `POST /api/leads`, the router calls:
  ```typescript
  sseBroadcaster.broadcast("NEW_LEAD", { leadId, serviceId });
  ```
  This iterates through the client `Map` using a target-compatible `forEach` construct and pushes the message stream down the pipeline.

---

### D. Server-Sent Events Route (`/app/api/sse/route.ts`)
- **How it works**: This route establishes the persistent HTTP link. It initializes a new native W3C `ReadableStream` that registers the browser client with a unique UUID inside our `sseBroadcaster` on startup. If the browser tab is closed, the stream triggers the `cancel()` callback, which cleans up and removes the client registry, avoiding memory leaks.

---

### E. Lead Intake Route (`/app/api/leads/route.ts`)
- **Input Validation**: Asserts that all form inputs (Customer Name, Phone, City, Service, and Description) are present.
- **Allocation & Event Launch**: Calls the transaction logic in `lib/allocation.ts` and triggers the SSE update broad.
- **Duplicate Prevention**: Handles compound key validation. If a user submits a lead with a phone number that already exists for that service, it catches the Prisma unique key constraint code `P2002` and yields a user-friendly `409 Conflict` error instead of throwing a generic server crash.

---

### F. Webhook Idempotency Route (`/app/api/webhook/route.ts`)
Ensures external webhooks (like `QUOTA_RESET` triggers) are only processed exactly once.
- **How it works**: When a request arrives, it checks the `WebhookEvent` table for the provided `idempotencyKey`. If it exists, it ignores the request and returns a safe success status. If it is new, it performs an atomic transaction that registers the `idempotencyKey` in the table and resets all provider monthly leads to 0.

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 3. FRONTEND TESTING AND DIAGNOSTICS
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You can verify and test all concurrency-safety features through the custom **Testing Panel** (`/test-tools`):

1. **Quota Reset Simulation**: Click **"Reset All Quotas"** to verify that provider workloads are cleared and zeroed. Generates a new UUID idempotency key on each request.
2. **Idempotency Key Verification**: Click **"Run Idempotency Test (5x)"**. This triggers 5 parallel webhook reset commands to `/api/webhook` with the **exact same** idempotency key.
   - **Expected behavior**: The console logger will display that the first call responded with `PROCESSED (NEW EVENT)` while the other 4 parallel requests were successfully filtered and `IGNORED (DUPLICATE DETECTED)`.
3. **Simultaneous Lead Concurrency Test**: Click **"Generate 10 Leads"**. This triggers 10 POST requests in parallel using `Promise.all` with randomized names, cities, and services.
   - **Expected behavior**: The locked database transaction processes them sequentially. You will see provider lead quotas and allocation indices increment in a perfect round-robin sequence without collisions or quota overruns!
