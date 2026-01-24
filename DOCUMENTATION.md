# Big Teds Sports Analytics Platform - Complete Documentation Bible

## Table of Contents

1. [Project Overview](#project-overview)
2. [Analytics Engine](#analytics-engine)
3. [Architecture](#architecture)
4. [Getting Started](#getting-started)
5. [Development Guide](#development-guide)
6. [API Documentation](#api-documentation)
7. [Database Schema](#database-schema)
8. [Deployment](#deployment)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)
11. [Contributing](#contributing)

---

## Project Overview

### What is Big Teds Sports Analytics Platform?

Big Teds Sports Analytics Platform is a performance-diagnostics system that quantifies not just how fast a team runs, but **why time is lost**, **where it can be recovered**, and **which skills matter most for improvement** — grounded directly in UFBA rules and event design.

The platform is designed as a scalable sports analytics, coaching, and performance tracking system. The first sport supported is Waterways competitions, with architecture designed to support multiple sports in the future.

### Core Features

- **Performance Diagnostics**: Quantify why time is lost and where it can be recovered
- **Skill Impact Analysis**: Identify which skills matter most for improvement
- **UFBA Rule Integration**: Grounded directly in UFBA rules and event design
- **Competition Management**: Track seasons, competitions, and run results
- **Run-Level Analytics**: Like-for-like diagnostics across run types (A1, A3, A5, etc.)
- **Competition Trends**: Overall performance tracking with median clean times and penalty analysis
- **Coaching Insights**: Automated coaching summaries with drill recommendations
- **Penalty Registry**: Verbatim rulebook references with taxonomy classification
- **Run Library**: Data-driven run specifications stored as JSON

### Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Backend**: Node.js 18+ + TypeScript + Express
- **Database**: PostgreSQL 16 + Prisma ORM
- **Charts**: Recharts
- **Monorepo**: Turborepo with npm workspaces
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs

---

## Analytics Engine

### Overview

The Analytics Engine (`packages/analytics-engine`) is a pure, deterministic TypeScript package that provides versioned, testable, and extensible analytics computations. It serves as a boundary between data access and computation logic.

### Key Features

- **Pure Functions**: No side effects, no Express, no React dependencies
- **Versioned**: `ANALYTICS_VERSION = "2.0.0"` tracks computation algorithm versions
- **Deterministic**: Same inputs always produce same outputs
- **Testable**: Unit tests with fixed fixtures ensure correctness
- **Extensible**: Easy to add new computation functions

### Analytics Functions

#### `computeCompetitionTrends(competitions: CompetitionData[]): CompetitionTrend[]`
Computes competition-level performance trends including median clean time, penalty load, penalty rate, and consistency (IQR).

#### `computeRunDiagnostics(runResults: RunResultData[], windowSize?: number): RunDiagnostic`
Computes run-level diagnostics for a specific run type with rolling median and IQR bands.

#### `computeDrivers(competitions: CompetitionData[]): DriverAnalysis[]`
Analyzes performance drivers by run type, identifying penalty patterns and taxonomy breakdowns.

#### `computeRecoverableTime(runResults: RunResultData[])`
Estimates recoverable time = penaltySeconds + variance estimate (IQR * 0.5).

#### `applyScenarioAdjustments(competitions: CompetitionData[], adjustments: ScenarioAdjustmentData[]): CompetitionData[]`
Applies scenario adjustments to baseline data without modifying actual run results.

### Scenario Simulation

Scenarios allow "what-if" analysis by overlaying adjustments on baseline data:

**Adjustment Types:**
- `REMOVE_PENALTY_TAXONOMY`: Remove all penalties matching a taxonomy code
- `OVERRIDE_PENALTY_SECONDS`: Override penalty seconds for specific rules/taxonomies
- `CLEAN_TIME_DELTA`: Adjust clean time by a delta (optionally filtered by run type)

**Scope Types:**
- `SEASON`: Apply to all competitions in a season
- `COMPETITION`: Apply to a specific competition
- `RUN_TYPE`: Apply to all runs of a specific type
- `RUN_RESULT`: Apply to a specific run result

### Analytics Versioning

All analytics computations are tracked with:
- `analyticsVersion`: Algorithm version (e.g., "2.0.0")
- `AnalyticsRun`: Records each computation with params, scope, duration
- `AnalyticsArtifact`: Stores outputs as JSON for caching/replay

### Usage Example

```typescript
import {
  computeCompetitionTrends,
  applyScenarioAdjustments,
} from "@waterways/analytics-engine";

// Load baseline data
const competitions = await loadCompetitionsForAnalytics(seasonId);

// Optionally apply scenario
if (scenarioId) {
  const adjustments = await loadScenarioAdjustments(scenarioId);
  competitions = applyScenarioAdjustments(competitions, adjustments);
}

// Compute analytics
const trends = computeCompetitionTrends(competitions);
```

---

## Architecture

### System Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    User Interface                        â”‚
â”‚              (React SPA - Vite + Tailwind)               â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                     â”‚ HTTP/REST API
                     â”‚ (JWT Authentication)
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚              Express API Server                         â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”           â”‚
â”‚  â”‚  Auth    â”‚  â”‚  Routes   â”‚  â”‚ Analyticsâ”‚           â”‚
â”‚  â”‚Middlewareâ”‚  â”‚  (CRUD)   â”‚  â”‚  Engine  â”‚           â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜           â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                     â”‚ Prisma ORM
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚            PostgreSQL Database                         â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”          â”‚
â”‚  â”‚  Users   â”‚  â”‚Competitionsâ”‚ â”‚Run Resultsâ”‚          â”‚
â”‚  â”‚  Roles   â”‚  â”‚  Seasons  â”‚ â”‚  Penaltiesâ”‚          â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Monorepo Structure

```
big-teds-sports-platform/
â”œâ”€â”€ apps/
â”‚   â”œâ”€â”€ api/              # Express backend API
â”‚   â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”‚   â”œâ”€â”€ index.ts          # Main server entry
â”‚   â”‚   â”‚   â”œâ”€â”€ routes/           # API route handlers
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ auth.ts
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ seasons.ts
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ competitions.ts
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ runResults.ts
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ runTypes.ts
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ runSpecs.ts
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ penaltyRules.ts
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ analytics.ts
â”‚   â”‚   â”‚   â””â”€â”€ middleware/
â”‚   â”‚   â”‚       â”œâ”€â”€ auth.ts       # JWT authentication
â”‚   â”‚   â”‚       â””â”€â”€ errorHandler.ts
â”‚   â”‚   â””â”€â”€ package.json
â”‚   â”‚
â”‚   â””â”€â”€ web/              # React frontend
â”‚       â”œâ”€â”€ src/
â”‚       â”‚   â”œâ”€â”€ pages/            # Route pages
â”‚       â”‚   â”œâ”€â”€ components/       # Reusable components
â”‚       â”‚   â”œâ”€â”€ lib/             # Utilities & API client
â”‚       â”‚   â””â”€â”€ App.tsx          # Main app component
â”‚       â””â”€â”€ package.json
â”‚
â”œâ”€â”€ packages/
â”‚   â”œâ”€â”€ db/               # Database package
â”‚   â”‚   â”œâ”€â”€ prisma/
â”‚   â”‚   â”‚   â”œâ”€â”€ schema.prisma    # Database schema
â”‚   â”‚   â”‚   â””â”€â”€ seed.ts          # Seed data
â”‚   â”‚   â””â”€â”€ src/
â”‚   â”‚       â””â”€â”€ index.ts         # Prisma client export
â”‚   â”‚
â”‚   â””â”€â”€ shared/            # Shared code
â”‚       â””â”€â”€ src/
â”‚           â”œâ”€â”€ schemas.ts       # Zod validation schemas
â”‚           â”œâ”€â”€ types.ts         # TypeScript types
â”‚           â””â”€â”€ index.ts        # Public exports
â”‚
â”œâ”€â”€ docker-compose.yml     # Local PostgreSQL setup
â”œâ”€â”€ package.json          # Root workspace config
â”œâ”€â”€ turbo.json            # Turborepo config
â””â”€â”€ render.yaml           # Render deployment config
```

### Data Flow

1. **User Action** â†’ React component makes API call
2. **API Request** â†’ Express route handler receives request
3. **Authentication** â†’ JWT middleware validates token
4. **Authorization** â†’ Role-based access control (if needed)
5. **Business Logic** â†’ Route handler processes request
6. **Database** â†’ Prisma ORM queries PostgreSQL
7. **Response** â†’ JSON data returned to frontend
8. **UI Update** â†’ React component updates with new data

---

## Getting Started

### Prerequisites

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher (comes with Node.js)
- **Docker Desktop**: For local PostgreSQL database
- **Git**: For version control

### Installation

#### 1. Clone Repository

```bash
git clone https://github.com/bigtednz/waterways.git
cd waterways
```

#### 2. Install Dependencies

```bash
npm install
```

This installs all dependencies for the monorepo using npm workspaces.

#### 3. Start PostgreSQL Database

```bash
docker-compose up -d
```

This starts a PostgreSQL 16 container on port 5432 with:
- Database: `waterways`
- User: `waterways`
- Password: `waterways_dev`

#### 4. Configure Environment Variables

**Root `.env` (optional for local dev):**
```env
DATABASE_URL=postgresql://waterways:waterways_dev@localhost:5432/waterways
```

**API `.env` (`apps/api/.env`):**
```env
DATABASE_URL=postgresql://waterways:waterways_dev@localhost:5432/waterways
API_PORT=3001
JWT_SECRET=your-secret-key-here
NODE_ENV=development
```

**Web `.env` (`apps/web/.env`):**
```env
VITE_API_URL=/api
```

#### 5. Set Up Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database with initial data
npm run db:seed
```

The seed script creates:
- Admin user: `admin@waterways.com` / `admin123`
- 9 run types (A1, A3, A5, A7, F9, F11, P13, P15, P17)
- Sample season and competition
- Example run results
- Sample penalty rules

#### 6. Start Development Servers

**Terminal 1 - API Server:**
```bash
cd apps/api
npm run dev
```
API runs on `http://localhost:3001`

**Terminal 2 - Web App:**
```bash
cd apps/web
npm run dev
```
Web app runs on `http://localhost:3000`

#### 7. Access Application

1. Open `http://localhost:3000` in browser
2. Login with:
   - Email: `admin@waterways.com`
   - Password: `admin123`

---

## Development Guide

### Available Scripts

#### Root Level

```bash
npm run dev          # Start all services in dev mode (via Turbo)
npm run build        # Build all packages (via Turbo)
npm run lint         # Lint all packages
npm run test         # Run all tests
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run database migrations
npm run db:migrate:deploy  # Deploy migrations (production)
npm run db:seed      # Seed database
npm run db:studio    # Open Prisma Studio (database GUI)
```

#### API (`apps/api`)

```bash
npm run dev          # Start with hot reload (tsx watch)
npm run build        # Compile TypeScript
npm start            # Run production build
npm run lint         # Lint TypeScript
npm test             # Run tests
```

#### Web (`apps/web`)

```bash
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Lint TypeScript/React
```

### Adding New Features

#### 1. Database Changes

1. Edit `packages/db/prisma/schema.prisma`
2. Create migration: `npm run db:migrate`
3. Generate Prisma client: `npm run db:generate`

#### 2. New API Endpoint

1. Create route file in `apps/api/src/routes/`
2. Add router to `apps/api/src/index.ts`
3. Add validation schema in `packages/shared/src/schemas.ts`
4. Add TypeScript types in `packages/shared/src/types.ts`

#### 3. New Frontend Page

1. Create page component in `apps/web/src/pages/`
2. Add route in `apps/web/src/App.tsx`
3. Add navigation link in `apps/web/src/components/Layout.tsx`

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured for TypeScript and React
- **Prettier**: Code formatting
- **Imports**: Use `.js` extensions for ESM compatibility

---

## API Documentation

### Base URL

- **Development**: `http://localhost:3001/api`
- **Production**: `https://your-domain.com/api`

### Authentication

All endpoints (except `/auth/login` and `/auth/register`) require authentication via JWT token.

**Header Format:**
```
Authorization: Bearer <token>
```

### Endpoints

#### Authentication

##### `POST /api/auth/register`

Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name"
}
```

**Response:**
```json
{
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "name": "User Name",
    "role": "VIEWER"
  },
  "token": "eyJhbGc..."
}
```

##### `POST /api/auth/login`

Login and get JWT token.

**Request Body:**
```json
{
  "email": "admin@waterways.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "user": {
    "id": "clx...",
    "email": "admin@waterways.com",
    "name": "Admin User",
    "role": "ADMIN"
  },
  "token": "eyJhbGc..."
}
```

##### `GET /api/auth/me`

Get current authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "clx...",
  "email": "admin@waterways.com",
  "name": "Admin User",
  "role": "ADMIN"
}
```

#### Seasons

##### `GET /api/seasons`

List all seasons.

**Query Parameters:**
- None

**Response:**
```json
[
  {
    "id": "clx...",
    "name": "2024 Season",
    "year": 2024,
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-12-31T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Competitions

##### `GET /api/competitions`

List competitions.

**Query Parameters:**
- `seasonId` (optional): Filter by season ID

**Response:**
```json
[
  {
    "id": "clx...",
    "seasonId": "clx...",
    "name": "Spring Championship",
    "date": "2024-03-15T00:00:00.000Z",
    "location": "National Waterways Center",
    "notes": null,
    "season": { ... },
    "runResults": [ ... ],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

##### `GET /api/competitions/:id`

Get competition details.

**Response:**
```json
{
  "id": "clx...",
  "seasonId": "clx...",
  "name": "Spring Championship",
  "date": "2024-03-15T00:00:00.000Z",
  "location": "National Waterways Center",
  "season": { ... },
  "runResults": [
    {
      "id": "clx...",
      "runType": { "code": "A1", "name": "Run A1" },
      "totalTimeSeconds": 125.5,
      "penaltySeconds": 5.0,
      "penalties": [ ... ]
    }
  ]
}
```

##### `POST /api/competitions`

Create competition. **Requires ADMIN or COACH role.**

**Request Body:**
```json
{
  "seasonId": "clx...",
  "name": "Spring Championship",
  "date": "2024-03-15",
  "location": "National Waterways Center",
  "notes": "Optional notes"
}
```

##### `PUT /api/competitions/:id`

Update competition. **Requires ADMIN or COACH role.**

**Request Body:** (all fields optional)
```json
{
  "name": "Updated Name",
  "date": "2024-03-20",
  "location": "New Location"
}
```

##### `DELETE /api/competitions/:id`

Delete competition. **Requires ADMIN role.**

**Response:** 204 No Content

#### Run Results

##### `GET /api/run-results`

List run results.

**Query Parameters:**
- `competitionId` (optional): Filter by competition
- `runTypeId` (optional): Filter by run type

**Response:**
```json
[
  {
    "id": "clx...",
    "competitionId": "clx...",
    "runTypeId": "clx...",
    "totalTimeSeconds": 125.5,
    "penaltySeconds": 5.0,
    "notes": "Sample run",
    "runType": { "code": "A1", "name": "Run A1" },
    "competition": { "name": "Spring Championship", ... },
    "penalties": [ ... ],
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

##### `POST /api/run-results`

Create single run result. **Requires ADMIN or COACH role.**

**Request Body:**
```json
{
  "competitionId": "clx...",
  "runTypeId": "clx...",
  "totalTimeSeconds": 125.5,
  "penaltySeconds": 5.0,
  "notes": "Optional notes"
}
```

##### `POST /api/run-results/bulk`

Bulk create run results. **Requires ADMIN or COACH role.**

**Request Body:**
```json
{
  "competitionId": "clx...",
  "runs": [
    {
      "runTypeCode": "A1",
      "totalTimeSeconds": 125.5,
      "penaltySeconds": 5.0,
      "notes": "Run A1"
    },
    {
      "runTypeCode": "A3",
      "totalTimeSeconds": 118.2,
      "penaltySeconds": 0,
      "notes": "Run A3"
    }
  ]
}
```

##### `PUT /api/run-results/:id`

Update run result. **Requires ADMIN or COACH role.**

##### `DELETE /api/run-results/:id`

Delete run result. **Requires ADMIN or COACH role.**

#### Analytics

##### `GET /api/analytics/competition-trends`

Get competition-level performance trends.

**Query Parameters:**
- `seasonId` (optional): Filter by season

**Response:**
```json
[
  {
    "competitionId": "clx...",
    "competitionName": "Spring Championship",
    "competitionDate": "2024-03-15T00:00:00.000Z",
    "medianCleanTime": 120.5,
    "penaltyLoad": 15.0,
    "penaltyRate": 0.33,
    "consistencyIQR": 8.5,
    "runCount": 9
  }
]
```

##### `GET /api/analytics/run-diagnostics`

Get run-level diagnostics for a specific run type.

**Query Parameters:**
- `runTypeCode` (required): Run type code (e.g., "A1")
- `windowSize` (optional): Rolling window size (default: 3)
- `scenarioId` (optional): Apply scenario adjustments
- `persist` (optional): Set to "true" to cache results

**Response (without scenario):**
```json
{
  "runTypeCode": "A1",
  "runTypeName": "Run A1",
  "dataPoints": [
    {
      "competitionId": "clx...",
      "competitionName": "Spring Championship",
      "competitionDate": "2024-03-15T00:00:00.000Z",
      "cleanTime": 120.5,
      "penaltySeconds": 5.0,
      "totalTimeSeconds": 125.5
    }
  ],
  "rollingMedian": [
    {
      "competitionDate": "2024-03-15T00:00:00.000Z",
      "value": 120.5
    }
  ],
  "rollingIQR": [
    {
      "competitionDate": "2024-03-15T00:00:00.000Z",
      "lower": 115.0,
      "upper": 125.0
    }
  ]
}
```

##### `GET /api/analytics/drivers`

Get performance drivers analysis.

**Query Parameters:**
- `seasonId` (optional): Filter by season
- `scenarioId` (optional): Apply scenario adjustments
- `persist` (optional): Set to "true" to cache results

**Response (without scenario):**
```json
[
  {
    "runTypeCode": "A1",
    "runTypeName": "Run A1",
    "penaltyCount": 5,
    "totalPenaltySeconds": 25.0,
    "taxonomyBreakdown": [
      {
        "taxonomyCode": "ORDER_VIOLATION",
        "count": 3,
        "totalSeconds": 15.0
      }
    ],
    "trendImpact": "stable"
  }
]
```

##### `GET /api/analytics/coaching-summary`

Get automated coaching summary.

**Query Parameters:**
- `seasonId` (optional): Filter by season
- `runTypeCode` (optional): Filter by run type

**Response:**
```json
{
  "narrative": "Performance is improving. Recent median clean time is 118.5s (down from 125.0s)...",
  "confidence": "high",
  "keyFindings": [
    "High penalty rate indicates procedural issues",
    "Most common issues: ORDER_VIOLATION, PROCEDURE_ERROR"
  ],
  "recommendedDrills": [
    {
      "drillId": "clx...",
      "drillName": "Order Chain Practice",
      "reason": "Addresses ORDER_VIOLATION"
    }
  ]
}
```

#### Other Endpoints

##### `GET /api/run-types`

List all run types.

##### `GET /api/run-specs/:runTypeCode`

Get run specification for a run type.

##### `GET /api/penalty-rules`

List penalty rules.

**Query Parameters:**
- `runTypeCode` (optional): Filter by run type

#### Scenarios

##### `GET /api/scenarios`

List all scenarios.

**Response:**
```json
[
  {
    "id": "clx...",
    "name": "No Order Violations",
    "notes": "Simulate removing all order violation penalties",
    "createdById": "clx...",
    "createdBy": { ... },
    "_count": { "adjustments": 2 },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

##### `GET /api/scenarios/:id`

Get scenario with adjustments.

**Response:**
```json
{
  "id": "clx...",
  "name": "No Order Violations",
  "notes": "...",
  "adjustments": [
    {
      "id": "clx...",
      "scopeType": "SEASON",
      "scopeId": "clx...",
      "adjustmentType": "REMOVE_PENALTY_TAXONOMY",
      "payloadJson": {
        "taxonomyCode": "ORDER_VIOLATION"
      }
    }
  ]
}
```

##### `POST /api/scenarios`

Create scenario. **Requires ADMIN or COACH role.**

**Request Body:**
```json
{
  "name": "No Order Violations",
  "notes": "Simulate removing all order violation penalties"
}
```

##### `POST /api/scenarios/:id/adjustments`

Add adjustment to scenario. **Requires ADMIN or COACH role.**

**Request Body:**
```json
{
  "scopeType": "SEASON",
  "scopeId": "clx...",
  "adjustmentType": "REMOVE_PENALTY_TAXONOMY",
  "payloadJson": {
    "taxonomyCode": "ORDER_VIOLATION"
  }
}
```

**Adjustment Payload Examples:**

- `REMOVE_PENALTY_TAXONOMY`: `{ "taxonomyCode": "ORDER_VIOLATION" }`
- `OVERRIDE_PENALTY_SECONDS`: `{ "taxonomyCode": "ORDER_VIOLATION", "newSeconds": 5 }` or `{ "penaltyRuleId": "pr1", "newSeconds": 5 }`
- `CLEAN_TIME_DELTA`: `{ "secondsDelta": 5, "runTypeCode": "A1" }` (runTypeCode optional)

##### `DELETE /api/scenarios/:id/adjustments/:adjustmentId`

Delete adjustment. **Requires ADMIN or COACH role.**

##### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

---

## Database Schema

### Entity Relationship Diagram

```
User
  â”œâ”€â”€ createdRunResults (RunResult[])
  â””â”€â”€ prescriptions (Prescription[])

Season
  â””â”€â”€ competitions (Competition[])

Competition
  â”œâ”€â”€ season (Season)
  â””â”€â”€ runResults (RunResult[])

RunType
  â”œâ”€â”€ runResults (RunResult[])
  â”œâ”€â”€ runSpecs (RunSpec[])
  â”œâ”€â”€ penaltyRules (PenaltyRule[])
  â””â”€â”€ prescriptions (Prescription[])

RunResult
  â”œâ”€â”€ competition (Competition)
  â”œâ”€â”€ runType (RunType)
  â”œâ”€â”€ createdBy (User)
  â”œâ”€â”€ penalties (RunPenalty[])
  â””â”€â”€ prescriptions (Prescription[])

RunSpec
  â””â”€â”€ runType (RunType)

PenaltyRule
  â”œâ”€â”€ runType (RunType?)
  â””â”€â”€ runPenalties (RunPenalty[])

RunPenalty
  â”œâ”€â”€ runResult (RunResult)
  â””â”€â”€ penaltyRule (PenaltyRule)

Drill
  â””â”€â”€ (standalone)

Prescription
  â”œâ”€â”€ runResult (RunResult?)
  â”œâ”€â”€ runType (RunType?)
  â””â”€â”€ createdBy (User)
```

### Models

#### User

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String   // bcrypt hashed
  role      UserRole @default(VIEWER)
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Roles:**
- `ADMIN`: Full access
- `COACH`: Can create/edit competitions and run results
- `VIEWER`: Read-only access

#### Season

```prisma
model Season {
  id          String        @id @default(cuid())
  name        String
  year        Int
  startDate   DateTime?
  endDate     DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  competitions Competition[]
}
```

#### Competition

```prisma
model Competition {
  id          String      @id @default(cuid())
  seasonId    String
  name        String
  date        DateTime
  location    String?
  notes       String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  season      Season      @relation(...)
  runResults  RunResult[]
}
```

#### RunType

```prisma
model RunType {
  id          String      @id @default(cuid())
  code        String      @unique  // e.g., "A1", "A3"
  name        String      // e.g., "Run A1"
  description String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  runResults  RunResult[]
  runSpecs    RunSpec[]
  penaltyRules PenaltyRule[]
}
```

#### RunResult

```prisma
model RunResult {
  id              String        @id @default(cuid())
  competitionId   String
  runTypeId       String
  totalTimeSeconds Float
  penaltySeconds  Float         @default(0)
  notes           String?
  createdById     String
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  competition     Competition   @relation(...)
  runType         RunType       @relation(...)
  createdBy       User          @relation(...)
  penalties       RunPenalty[]
}
```

**Clean Time Calculation:**
```
cleanTime = Math.max(0, totalTimeSeconds - penaltySeconds)
```

#### PenaltyRule

```prisma
model PenaltyRule {
  id            String      @id @default(cuid())
  ruleId        String      @unique
  runTypeCode   String?     // null = applies to all
  ruleText      String      // verbatim from rulebook
  taxonomyCode  String      // internal classification
  severity      String      // "minor", "major", "critical"
  outcomeType   String      // "time_penalty", "disqualification"
  outcomeSeconds Float?     // null if not time penalty
  sourcePdfRef  String?     // "Section 4.2.3, Page 12"
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  runType       RunType?    @relation(...)
  runPenalties  RunPenalty[]
}
```

#### AnalyticsRun

```prisma
model AnalyticsRun {
  id              String   @id @default(cuid())
  analyticsVersion String
  computationType  String   // "competition-trends", "run-diagnostics", "drivers"
  paramsJson       Json     // stable, sorted JSON of input parameters
  scopeType        String?  // "SEASON", "COMPETITION", "RUN_TYPE", "ALL"
  scopeId          String?
  scenarioId       String?
  status           String   @default("completed")
  durationMs       Int?
  runAt            DateTime @default(now())
  createdById      String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  createdBy        User?    @relation(...)
  scenario         Scenario? @relation(...)
  artifacts        AnalyticsArtifact[]
}
```

Tracks each analytics computation run for versioning and caching.

#### AnalyticsArtifact

```prisma
model AnalyticsArtifact {
  id              String       @id @default(cuid())
  analyticsRunId  String
  analyticsVersion String
  artifactKey     String       // e.g., "competition-trends", "run-diagnostics:A3"
  outputJson      Json         // computed output stored as JSON
  metadata        Json?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  analyticsRun    AnalyticsRun @relation(...)
}
```

Stores computed analytics outputs for caching and replay.

#### Scenario

```prisma
model Scenario {
  id          String   @id @default(cuid())
  name        String
  notes       String?
  createdById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdBy  User?    @relation(...)
  adjustments ScenarioAdjustment[]
  analyticsRuns AnalyticsRun[]
}
```

Represents a scenario for "what-if" analysis.

#### ScenarioAdjustment

```prisma
enum ScenarioScopeType {
  SEASON
  COMPETITION
  RUN_TYPE
  RUN_RESULT
}

enum ScenarioAdjustmentType {
  REMOVE_PENALTY_TAXONOMY
  OVERRIDE_PENALTY_SECONDS
  CLEAN_TIME_DELTA
}

model ScenarioAdjustment {
  id                String                  @id @default(cuid())
  scenarioId        String
  scopeType         ScenarioScopeType
  scopeId           String?                 // ID of scoped entity
  adjustmentType    ScenarioAdjustmentType
  payloadJson       Json                    // type-specific payload
  createdAt         DateTime                @default(now())
  updatedAt         DateTime                @updatedAt
  scenario          Scenario                @relation(...)
}
```

Individual adjustments within a scenario.

### Database Migrations

**Create Migration:**
```bash
npm run db:migrate
```

**Deploy Migrations (Production):**
```bash
npm run db:migrate:deploy
```

**Reset Database (Development):**
```bash
# WARNING: This deletes all data!
npx prisma migrate reset
```

---

## Deployment

### Railway (Recommended)

#### Setup

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect `bigtednz/waterways` repository

3. **Add PostgreSQL Database**
   - Click "+ New" â†’ "Database" â†’ "Add PostgreSQL"
   - Railway auto-creates `DATABASE_URL` environment variable

4. **Configure Environment Variables**
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = (generate random secret)
   - `DATABASE_URL` = (auto-set from PostgreSQL service)
   - `PORT` = (Railway sets automatically)

5. **Deploy**
   - Railway detects `railway.json` automatically
   - Builds and deploys on every push to main branch

#### Railway Configuration

Create `railway.json` in project root:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run db:generate && npm run build"
  },
  "deploy": {
    "startCommand": "npm run db:migrate:deploy && cd apps/api && npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Render

#### Setup

1. **Create Render Account**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub

2. **Create Blueprint**
   - Click "New +" â†’ "Blueprint"
   - Connect GitHub repository
   - Render detects `render.yaml`

3. **Configure Services**
   - PostgreSQL database auto-created
   - Web service auto-created from `render.yaml`

#### Render Configuration

See `render.yaml` in project root for configuration.

### Environment Variables

**Required:**
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT token signing
- `NODE_ENV`: `production` for production

**Optional:**
- `API_PORT`: Port for API server (default: 3001)
- `PORT`: Used by Railway (auto-set)

### Build Process

1. Install dependencies: `npm install`
2. Generate Prisma client: `npm run db:generate`
3. Build web app: `npm run build` (builds via Turbo)
4. Build API: TypeScript compilation
5. Run migrations: `npm run db:migrate:deploy`
6. Start server: `cd apps/api && npm start`

---

## Troubleshooting

### Common Issues

#### Build Fails: "vite command not found"

**Solution:** Use `npx vite build` in `apps/web/package.json` build script.

#### TypeScript Errors: "JSX element implicitly has type 'any'"

**Solution:** Ensure `@types/react` is installed and `tsconfig.json` has correct JSX settings.

#### Database Connection Errors

**Check:**
1. PostgreSQL is running: `docker-compose ps`
2. `DATABASE_URL` is correct
3. Database exists: `psql -U waterways -d waterways`

#### Prisma Client Not Generated

**Solution:**
```bash
npm run db:generate
```

#### Migration Errors

**Solution:**
```bash
# Reset and re-run migrations (DEVELOPMENT ONLY)
npx prisma migrate reset
npm run db:migrate
npm run db:seed
```

#### Port Already in Use

**Solution:**
- Change `API_PORT` in `.env`
- Or kill process using port: `lsof -ti:3001 | xargs kill`

### Debugging

#### View API Logs

```bash
cd apps/api
npm run dev
```

#### View Database

```bash
npm run db:studio
```

Opens Prisma Studio at `http://localhost:5555`

#### Test API Endpoints

```bash
# Health check
curl http://localhost:3001/health

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@waterways.com","password":"admin123"}'
```

---

## Best Practices

### Code Organization

1. **Keep routes focused**: One route file per resource
2. **Use middleware**: Authentication, validation, error handling
3. **Shared code**: Put in `packages/shared`
4. **Type safety**: Use Zod schemas for validation
5. **Error handling**: Use error handler middleware

### Database

1. **Migrations**: Always use migrations, never edit schema directly
2. **Indexes**: Add indexes for frequently queried fields
3. **Relations**: Use Prisma relations, not manual joins
4. **Transactions**: Use for multi-step operations

### API Design

1. **RESTful**: Follow REST conventions
2. **Status codes**: Use appropriate HTTP status codes
3. **Error responses**: Consistent error format
4. **Pagination**: Add pagination for list endpoints (future)

### Security

1. **Passwords**: Always hash with bcrypt
2. **JWT**: Use secure secrets, set expiration
3. **Validation**: Validate all input with Zod
4. **Authorization**: Check roles for protected endpoints

### Performance

1. **Database queries**: Use `include` to avoid N+1 queries
2. **Caching**: Consider caching for analytics (future)
3. **Indexing**: Index foreign keys and frequently queried fields

---

## Contributing

### Development Workflow

1. Create feature branch: `git checkout -b feature/new-feature`
2. Make changes
3. Test locally
4. Commit: `git commit -m "Add new feature"`
5. Push: `git push origin feature/new-feature`
6. Create pull request

### Code Standards

- **TypeScript**: Strict mode, no `any` types
- **Formatting**: Prettier auto-format
- **Linting**: ESLint must pass
- **Tests**: Add tests for new features

### Commit Messages

Use conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Tests

---

## License

Proprietary - Big Teds Sports Analytics Platform

---

## Support

For issues or questions:
- GitHub Issues: [github.com/bigtednz/waterways/issues](https://github.com/bigtednz/waterways/issues)
- Documentation: This file

---

**Last Updated:** January 2025
**Version:** 1.0.0
