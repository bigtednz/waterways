# AI Handoff: Project Changes & Dashboard Improvement Guide

**For:** ChatGPT or other AI assistants  
**Purpose:** Summary of what was done on this repo and what’s needed to keep improving the Dashboard page.

---

## 1. What Has Been Done on the Project

### 1.1 Dashboard Page (apps/web/src/pages/DashboardPage.tsx)

- **Route consistency:** All in-app links use the `/app/` prefix (e.g. `/app/analysis`, `/app/competitions`, `/app/competitions/:id`, `/app/competitions/new`, `/app/penalties`). Quick links and Recent Competitions were updated accordingly.
- **Accessibility:**
  - Performance alerts use `role="alert"` and `aria-live="polite"`.
  - Season and Scenario selects have proper `<label htmlFor="...">` and `id` on the `<select>` elements.
  - Scenario select has `aria-describedby="dashboard-scenario-hint"` and a hint element.
  - Performance Score card has `aria-label` (e.g. "Performance score 72 out of 100").
  - Error banners use `role="alert"`.
- **Empty & error states:**
  - When there are no seasons: a single empty-state card is shown (“No seasons yet”) with a “Go to Competitions” CTA; the rest of the dashboard is hidden.
  - When seasons fail to load: red banner with “Couldn’t load seasons” and link to Competitions.
  - When analytics (trends/drivers) fail: amber banner “Couldn’t load dashboard data.”
  - Main dashboard content (controls, metrics, charts, goals, quick links, recent competitions) only renders when `loading.seasons || seasons.length > 0`.
- **Copy & UX:**
  - Goals “View All” → “Manage goals below →”.
  - Scenario selector always shows a hint: “Compare performance if you change variables” or “Comparing baseline vs scenario performance” when a scenario is selected.
  - Recoverable time subtitle: “Estimated time you could gain by reducing penalties and variance.”
  - “Quick Diagnostics” section renamed to “Quick links.”
- **No structural refactor:** The page is still one large component (~1087 lines). Sections were not split into smaller components.

### 1.2 Archive & Cleanup

- **archive/** folder added at repo root with:
  - **README.md** describing archived files.
  - **RAILWAY_FIX_DATABASE_URL.md** and **RAILWAY_DATABASE_URL_FIX.md** moved here (redundant with RAILWAY_TROUBLESHOOTING.md).
- **Root package.json:** Duplicate script `build:manual` removed (same as `build`).

### 1.3 Prisma 7 Upgrade

- **packages/db:** Upgraded to Prisma 7 (prisma and @prisma/client ^7.4.0).
- **New:** `@prisma/adapter-pg`, `pg`, and (dev) `dotenv`, `@types/pg`.
- **Schema (packages/db/prisma/schema.prisma):**
  - Generator: `provider = "prisma-client"`, `output = "../src/generated/prisma"`, plus `generatedFileExtension` and `importFileExtension` set to `"ts"`.
  - Datasource: `url` removed; connection URL is only in `prisma.config.ts`.
- **packages/db/prisma.config.ts** added: schema path, migrations path, seed script, and `datasource.url` from `env("DATABASE_URL")` with `dotenv/config`.
- **packages/db/src/index.ts:** Uses `PrismaPg` adapter and generated client at `./generated/prisma/client.js`; exports `prisma` and re-exports from generated client.
- **Seed (packages/db/prisma/seed.ts):** Uses shared `prisma` and `UserRole` from `../src/index.js` instead of creating its own client.
- **API:** All `@prisma/client` imports changed to `@waterways/db` (UserRole, Prisma namespace) in apps/api.
- **Root package.json:** `engines.node` set to `>=20.19.0`.
- **Node version files:** `.nvmrc` and `.node-version` added with `22` for nvm/fnm.

### 1.4 Layout

- **apps/web/src/components/Layout.tsx** had been modified before these sessions (e.g. sidebar, mobile behavior). No further layout changes were made as part of the above work.

---

## 2. Project Context (for improving the Dashboard)

### 2.1 Tech Stack

- **Frontend:** React 19, TypeScript, Vite, TailwindCSS, React Router 6, Recharts.
- **App structure:** Routes under `/app/*` (e.g. `/app/dashboard`, `/app/competitions`, `/app/analysis`, `/app/run-library`, `/app/penalties`). Layout and nav live in `apps/web/src/components/Layout.tsx`.
- **API base:** `apps/web/src/lib/api.ts` (axios); backend is Express in `apps/api`.

### 2.2 Dashboard Data & APIs

- **Seasons:** `GET /seasons` — list of seasons (id, name, year, competitions).
- **Competition trends:** `GET /analytics/competition-trends?seasonId=...` (optional `scenarioId`).
- **Drivers:** `GET /analytics/drivers?seasonId=...`.
- **Scenarios:** `GET /scenarios`.
- **Goals:** Mix of API `GET/POST/PUT /goals` and localStorage fallback; dashboard also reads goals from localStorage for the summary and passes `competitionTrends` into `GoalsManager`.

### 2.3 Key Dashboard Sections (in order in the file)

1. Header: “Diagnostics Cockpit”, “View Full Analysis” link.
2. Error banners: `seasonsError`, `analyticsError`.
3. No-seasons empty state (when `!loading.seasons && seasons.length === 0 && !seasonsError`).
4. Performance alerts (when there are seasons and `alerts.length > 0`).
5. Controls: Season Scope select, Scenario Simulation select (when scenarios exist).
6. Goals summary (when `goals.length > 0`): counts (Active, Achieved, On Track, At Risk), “Manage goals below →”, and up to 3 progress bars.
7. Performance Score, Best Performance, Performance Forecast (three cards).
8. Scenario Impact (when a scenario is selected and scenario trends exist).
9. Key metrics: Median Clean Time, Total Penalty Time, Recoverable Time, Top Issue.
10. Performance Trend (Recharts LineChart) and Top Performance Issues (BarChart).
11. Quick links: Run Diagnostics, Trend Analysis, Fix Top Issue, Season Details.
12. Recent Competitions list (links to `/app/competitions/:id`).
13. Goals section: `<div id="goals">` with `<GoalsManager />`.

### 2.4 Important Files for Dashboard Work

- **Page:** `apps/web/src/pages/DashboardPage.tsx` (~1087 lines).
- **Related components:** `GoalsManager`, `GoalCard`, `GoalForm`, `GoalTemplateSelector` in `apps/web/src/components/`.
- **Lib:** `apps/web/src/lib/goals.ts`, `goalAutoUpdate.ts`, `goalNotifications.ts`, `performanceForecasting.ts`, `utils.ts` (formatDate, formatTime).

---

## 3. What Still Needs Improvement (for ChatGPT / future work)

### 3.1 Dashboard Page

- **Component size:** The page is one large component. Consider extracting sections into components (e.g. `DashboardAlerts`, `DashboardGoalsSummary`, `PerformanceScoreCard`, `PerformanceForecastCard`, `KeyMetricsGrid`, `PerformanceTrendChart`, `TopIssuesChart`, `QuickLinks`, `RecentCompetitions`) and composing them in `DashboardPage` to improve maintainability and readability.
- **Information order:** Consider reordering so the flow is: context (season/scenario) → one headline metric → alerts → goals summary → charts → quick actions → recent competitions → full goals. Current order is already reasonable but could be tuned for “story.”
- **Mobile:** On small screens the page is long and dense. Consider a “Summary vs full” toggle or a “Jump to” menu (e.g. Alerts, Goals, Chart, Quick links) for faster navigation.
- **Error recovery:** Add a “Retry” or “Reload” control for the seasons and analytics error banners so users can re-fetch without refreshing the whole page.
- **Charts accessibility:** Recharts doesn’t expose full a11y by default. Add a short text summary for the main charts (e.g. “Median clean time over last 6 competitions: X”) or ensure a link to “View in Analysis” is clearly available.
- **Goals “Manage goals below”:** Either keep as in-page anchor or add a dedicated `/app/goals` route and point “Manage goals” there for a focused experience.

### 3.2 General

- **Testing:** Add or extend tests for the dashboard (e.g. key metrics render, empty/error states, links use `/app/` routes).
- **README:** Update if needed for Prisma 7 (e.g. Node 20.19+, `npm run db:generate` after clone, that migrate runs generate).

---

## 4. Conventions to Follow

- Use **`/app/...`** for all in-app navigation links (e.g. `/app/competitions`, `/app/competitions/new`, `/app/competitions/:id`, `/app/analysis`, `/app/penalties`).
- Keep **accessibility** in mind: `role="alert"` for alerts, associated labels for form controls, `aria-label` or describedby where helpful.
- Prefer **functional components and hooks**; the codebase does not use class components.
- **Tailwind** for styling; avoid adding new CSS frameworks.

---

## 5. Quick Reference: Key Paths

| Item              | Path |
|-------------------|------|
| Dashboard page    | `apps/web/src/pages/DashboardPage.tsx` |
| Layout / nav      | `apps/web/src/components/Layout.tsx` |
| App routes        | `apps/web/src/App.tsx` |
| API client        | `apps/web/src/lib/api.ts` |
| Goals manager     | `apps/web/src/components/GoalsManager.tsx` |
| Prisma schema     | `packages/db/prisma/schema.prisma` |
| Prisma config     | `packages/db/prisma.config.ts` |
| DB package entry  | `packages/db/src/index.ts` |

Use this file to understand what’s already done and what to do next when improving the dashboard or the rest of the project.
