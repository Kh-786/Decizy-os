# Decizy — Decision-Intelligence Platform

**Decizy** is the decision-intelligence engine of **AnyRoomz** (Shop ID: 2906, [anyroomz.com](https://anyroomz.com)), purpose-built for managing high-stakes architecture and interior design projects across India.

It equips project owners, architects, and project managers with structured decision catalogues, prerequisite locks, downstream change-impact propagation, and immutable audit logs.

---

## Key Features

1. **A0 Decision Check & Intake Screening**:
   - Responsive questionnaire capturing Indian PIN codes, city, stage, budget range in INR, and core bottlenecks.
   - Generates unique intake references (e.g. `DCZ-A0-2026-XXXX`) with immediate priority recommendations.
   - Explicit screening disclaimer: Not professional architectural stamps or municipal approvals.

2. **33 Master Decision Types Catalogue**:
   - Comprehensive architectural taxonomy spanning 8 lifecycle phases (Zoning, Civil Demolition, Waterproofing, MEP/HVAC, Materials, Joinery, Loose FF&E, Snagging).
   - Versioned specifications with required inputs, expected deliverables, risk indicators, and sign-off rules.
   - In-app editor for authorized administrators.

3. **Dependency Engine & Change-Impact Control**:
   - Directed acyclic graph (DAG) dependency resolver.
   - Material specification revisions automatically flag downstream dependent decisions for engineering compatibility review.
   - Preserves complete, immutable revision history (Rev 1, Rev 2...).

4. **Multi-Role Workspaces & Role-Based Access Control (RBAC)**:
   - Built-in simulation switcher for **Customer / Owner**, **Lead Architect**, **Project Manager**, and **Platform Admin**.
   - Server-enforced PostgreSQL Row Level Security (RLS) policies.

5. **Selldone Genesis Commerce Integration Adapter**:
   - Clean architectural boundary: Selldone manages storefront catalog, orders, and payment gateways; Decizy manages project state, workflow, and approvals.
   - Built-in safe mock adapter for Shop ID 2906 with order lookup and entitlement provisioning.

6. **Durable Operational Audit Trail**:
   - Append-only chronological log of every status change, revision, and dependency flag.

---

## Beginner-Friendly Windows Setup Guide

If you are new to web development and using Windows 10 or 11, follow these exact steps:

### Step 1: Install Node.js
1. Visit [https://nodejs.org](https://nodejs.org) and download the **LTS (Long Term Support)** version.
2. Run the installer and click **Next** through the setup wizard (keep default settings).
3. To verify installation, open **PowerShell** or **Command Prompt** and type:
   ```powershell
   node -v
   npm -v
   ```
   You should see version numbers (e.g., `v20.x` or `v22.x`).

### Step 2: Open PowerShell in the Project Folder
1. Open Windows File Explorer and navigate to your `decizy` project folder.
2. Click in the address bar at the top, type `powershell`, and press **Enter**.

### Step 3: Install Dependencies
In the PowerShell window, run:
```powershell
npm install
```
Wait for the packages to finish downloading.

### Step 4: Configure Environment (Optional)
Decizy runs out-of-the-box in **Safe Demonstration Mode** without needing remote accounts or credit cards. If you want to connect live Supabase credentials later:
1. In PowerShell, make a copy of `.env.example`:
   ```powershell
   copy .env.example .env
   ```
2. Open `.env` in Notepad and insert your Supabase URL and key.

### Step 5: Start the Development Server
Run:
```powershell
npm run dev
```
You will see output like:
```text
VITE v8.x.x  ready in 300 ms
➜  Local:   http://localhost:3000/
```
Open your browser and navigate to **`http://localhost:3000`**.

### Step 6: Run Automated Tests & Type Checking
To run the built-in automated test suite:
```powershell
npm run test
```
To run TypeScript strict type checking:
```powershell
npm run lint
```

---

## Mac / Linux Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Run automated tests
npm run test

# 3. Start development server
npm run dev
```

---

## Project Structure

```text
├── src/
│   ├── components/
│   │   ├── a0/             # A0 Decision Check intake form & confirmation
│   │   ├── admin/          # Admin workspace, audit trail & RLS status
│   │   ├── dashboard/      # Executive KPI overview & delivery health
│   │   ├── decisions/      # Decision register & 33 Master Types catalogue
│   │   ├── layout/         # 3-Zone Top Bar & navigation
│   │   ├── projects/       # Project directory, dossier & documents
│   │   └── services/       # Service tiers (A0-C1) & Selldone console
│   ├── context/
│   │   ├── AuthContext.tsx    # Role switching & user personas
│   │   └── ProjectContext.tsx # Central state, revisions & audit logger
│   ├── data/
│   │   ├── masterDecisions.ts # 33 Master Decision Types seed database
│   │   └── demoData.ts        # Realistic Indian interior design seed data
│   ├── lib/
│   │   ├── selldone/       # Selldone Genesis typed adapter & mock
│   │   ├── supabase.ts     # Resilient Supabase client with safe demo mode
│   │   └── validation.ts   # Zod validation schemas
│   ├── services/
│   │   └── decisionEngine.ts # Dependency graph & change impact engine
│   ├── tests/
│   │   └── decizy.test.ts  # Automated test suite
│   ├── types/
│   │   └── index.ts        # Domain TypeScript definitions
│   ├── App.tsx             # Root application orchestrator
│   └── main.tsx            # Application entry point
├── supabase/
│   └── migrations/         # PostgreSQL schema & Row Level Security policies
├── .env.example            # Environment template
└── package.json            # Scripts & dependencies
```

---

## Technical Specifications
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **Validation**: Zod (Indian PIN codes, phone, area, budgets)
- **Database**: PostgreSQL (Supabase ready) with Row Level Security (RLS)
- **Commerce**: Selldone Genesis (Shop ID: 2906, anyroomz.com)
- **Currency**: Indian Rupee (INR ₹)
- **Timezone**: Indian Standard Time (IST / Asia/Kolkata)
