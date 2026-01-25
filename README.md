# Big Teds Sports Analytics Platform

A performance-diagnostics system that quantifies not just how fast a team runs, but **why time is lost**, **where it can be recovered**, and **which skills matter most for improvement** — grounded directly in UFBA rules and event design.

## Features

- **Competition Management**: Track seasons, competitions, and run results
- **Competition Day & Run Queue**: Record competition days with flexible run queues that match the actual event order on the day
- **Run-Level Analytics**: Like-for-like diagnostics across run types (A1, A3, A5, etc.)
- **Competition Trends**: Overall performance tracking with median clean times and penalty analysis
- **Coaching Insights**: Automated coaching summaries with drill recommendations
- **Penalty Registry**: Verbatim rulebook references with taxonomy classification
- **Run Library**: Data-driven run specifications stored as JSON

## Tech Stack

- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Node.js + TypeScript + Express
- **Database**: PostgreSQL + Prisma ORM
- **Charts**: Recharts
- **Monorepo**: Turborepo with npm workspaces

## Prerequisites

- Node.js 18+ 
- Docker and Docker Compose (for PostgreSQL)
- npm or yarn

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Start PostgreSQL Database

```bash
docker-compose up -d
```

This will start a PostgreSQL container on port 5432.

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Update the `.env` file if needed (defaults should work for local development).

### 4. Set Up Database

Generate Prisma client and run migrations:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

The seed script will create:
- An admin user: `admin@waterways.com` / `admin123`
- 9 run types (A1, A3, A5, A7, F9, F11, P13, P15, P17)
- A sample season and competition with example run results
- Sample penalty rules

### 5. Start Development Servers

In separate terminals:

**Terminal 1 - API Server:**
```bash
cd apps/api
npm run dev
```

The API will run on `http://localhost:3001`

**Terminal 2 - Web App:**
```bash
cd apps/web
npm run dev
```

The web app will run on `http://localhost:3000`

### 6. Access the Application

1. Open `http://localhost:3000` in your browser
2. Login with:
   - Email: `admin@waterways.com`
   - Password: `admin123`

## Project Structure

```
big-teds-sports-platform/
├── apps/
│   ├── api/          # Express backend
│   └── web/           # React frontend
├── packages/
│   ├── db/            # Prisma schema and migrations
│   └── shared/        # Shared types and zod schemas
├── docker-compose.yml # PostgreSQL container
└── package.json       # Root workspace config
```

## Key Concepts

### Competition Days & Run Queue
**Competition Days** allow you to record a competition on the day with a flexible run queue:
- The queue order matches the actual order events are run (which may differ from standard order)
- Events can be marked as PLANNED, RUN, or SKIPPED
- Reruns can be added as additional attempts for the same event
- Quick-add buttons for common events (A1, A3, A5, A7, F9, F11, P13, P15, P17) or enter custom event codes
- Reorder events using Move Up/Down buttons
- This is the foundation for later recording official times, split times, penalties, and competitor team results

### Run Types
Each competition contains multiple runs of different types (A1, A3, A5, etc.). Runs are NOT interchangeable - analytics compare like-for-like.

### Clean Time
Clean time = Total time - Penalty time (guarded against negative values). This is the primary metric for performance tracking.

### Competition-Level Analytics
- One data point per competition
- Uses median clean time across all runs (does NOT mix run types)
- Tracks penalty load, penalty rate, and consistency (IQR)

### Run Diagnostics
- Like-for-like comparison across competitions for a selected run type
- Rolling median and IQR bands
- Gap detection for breaks in competition schedule

### Penalty Rules
- Stored verbatim from rulebook PDF
- Mapped to taxonomy codes for classification
- Can apply to specific run types or all runs

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register (admin only in MVP)
- `GET /api/auth/me` - Get current user

### Competitions
- `GET /api/competitions` - List competitions
- `GET /api/competitions/:id` - Get competition details
- `POST /api/competitions` - Create competition
- `PUT /api/competitions/:id` - Update competition
- `DELETE /api/competitions/:id` - Delete competition

### Competition Days
- `GET /api/competition-days` - List competition days (newest first)
- `GET /api/competition-days/:id` - Get competition day with queue items
- `POST /api/competition-days` - Create competition day
- `PUT /api/competition-days/:id` - Update competition day
- `POST /api/competition-days/:id/queue` - Add queue item
- `PUT /api/competition-days/queue/:id` - Update queue item (status, notes, attemptNo, eventCode)
- `PUT /api/competition-days/:id/reorder` - Reorder queue items
- `DELETE /api/competition-days/queue/:id` - Delete queue item

### Run Results
- `GET /api/run-results` - List run results
- `POST /api/run-results` - Create single run result
- `POST /api/run-results/bulk` - Bulk create run results
- `PUT /api/run-results/:id` - Update run result
- `DELETE /api/run-results/:id` - Delete run result

### Analytics
- `GET /api/analytics/competition-trends` - Competition-level trends
- `GET /api/analytics/run-diagnostics?runTypeCode=A1` - Run-level diagnostics
- `GET /api/analytics/drivers` - Performance drivers analysis
- `GET /api/analytics/coaching-summary` - Coaching insights

### Other
- `GET /api/seasons` - List seasons
- `GET /api/run-types` - List run types
- `GET /api/run-specs/:runTypeCode` - Get run specification
- `GET /api/penalty-rules` - List penalty rules

## Development

### Database Commands

```bash
# Generate Prisma client
npm run db:generate

# Create and run migration
npm run db:migrate

# Seed database
npm run db:seed

# Open Prisma Studio (database GUI)
npm run db:studio
```

### Adding New Run Types

1. Add to seed script in `packages/db/prisma/seed.ts`
2. Run `npm run db:seed` (or manually insert via Prisma Studio)

### Adding Penalty Rules

Insert into `penalty_rules` table with:
- `ruleId`: Unique identifier
- `ruleText`: Verbatim text from rulebook
- `taxonomyCode`: Internal classification
- `runTypeCode`: Specific run type or NULL for all
- `outcomeSeconds`: Penalty amount (if time penalty)

### Adding Run Specifications

Insert into `run_specs` table with:
- `runTypeId`: Reference to run type
- `jsonSpec`: Machine-readable specification (JSON)
- `markdownPath`: Optional path to human-readable docs

## Production Deployment

The platform is configured for **Railway** deployment:

1. **Railway Setup:**
   - Create project at [railway.app](https://railway.app)
   - Connect GitHub repository
   - Add PostgreSQL database (Railway auto-creates `DATABASE_URL`)
   - Set environment variables: `NODE_ENV=production`, `JWT_SECRET`

2. **Automatic Deployment:**
   - Railway uses `railway.json` for configuration
   - Auto-deploys on push to main branch
   - Runs migrations automatically on deploy

3. **For detailed instructions:** See [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)

**Alternative:** The platform also supports Render deployment (see `render.yaml` for configuration).

## Testing

```bash
# Run all tests
npm test

# Frontend tests (Vitest)
cd apps/web && npm test

# Backend tests (Jest)
cd apps/api && npm test

# E2E tests (Playwright)
npm run test:e2e
```

## License

Proprietary - Big Teds Sports Analytics Platform
