# Deployment Architecture Guide
## Big Teds Sports Analytics Platform

This document explains the deployment architecture, why you need both a site and API, and best practices for scaling your sports analytics platform.

---

## Do You Need Both Site and API?

### **Yes, you need both, but they can be deployed together or separately.**

Your current architecture has:
- **Frontend (Site)**: React app that users interact with
- **Backend (API)**: Express server that handles data and business logic

### Two Deployment Options:

#### **Option 1: Combined Deployment (Current Setup)**
- API serves both API endpoints AND static frontend files
- Single service to manage
- Simpler for small-to-medium scale
- **Current code already supports this** (see `apps/api/src/index.ts` lines 138-147)

#### **Option 2: Separate Deployment (Recommended for Scale)**
- Frontend: Static site (CDN/hosting)
- API: Separate backend service
- Better for scaling, caching, and performance
- More complex to manage

**For your use case (scalable sports analytics platform), I recommend starting with Option 1, then moving to Option 2 as you scale.**

---

## What Does the API Do?

The API is the **brain** of your platform. It handles:

### 1. **Data Persistence**
- Stores all competition data, run results, seasons, penalties
- Manages user accounts and authentication
- Handles run specifications and penalty rules
- **Why API?** Direct database access from frontend is insecure. API provides controlled access.

### 2. **Business Logic & Analytics**
- Computes competition trends, run diagnostics, performance drivers
- Applies scenario simulations (what-if analysis)
- Calculates recoverable time estimates
- Generates coaching summaries
- **Why API?** Heavy computations shouldn't run in the browser. API can use server resources efficiently.

### 3. **Security & Authentication**
- User login/registration
- JWT token management
- Role-based access control (ADMIN, COACH, VIEWER)
- Data validation and sanitization
- **Why API?** Keeps sensitive operations server-side.

### 4. **Data Aggregation & Filtering**
- Season-based filtering
- Run type comparisons
- Historical trend analysis
- **Why API?** Efficient database queries, reduces data transfer.

### 5. **API Endpoints Provided**
```
Authentication:
  POST /api/auth/login
  POST /api/auth/register
  GET  /api/auth/me

Data Management:
  GET/POST/PUT/DELETE /api/seasons
  GET/POST/PUT/DELETE /api/competitions
  GET/POST/PUT/DELETE /api/run-results
  GET/POST/PUT/DELETE /api/run-specs
  GET /api/penalty-rules

Analytics (Core Value):
  GET /api/analytics/competition-trends
  GET /api/analytics/run-diagnostics
  GET /api/analytics/drivers
  GET /api/analytics/coaching-summary

Scenario Simulation:
  GET/POST/PUT/DELETE /api/scenarios
  GET /api/analytics/*?scenarioId=...
```

---

## Best Deployment Strategy for Your Platform

### **Recommended: Combined Deployment (Monolithic API)**

For a scalable sports analytics platform, here's the optimal setup:

#### **Architecture:**
```
┌─────────────────────────────────────────┐
│         Render.com / Cloud Platform     │
│                                          │
│  ┌──────────────────────────────────┐  │
│  │   API Service (Node.js/Express)   │  │
│  │   - Handles /api/* requests       │  │
│  │   - Serves static frontend files  │  │
│  │   - Connects to PostgreSQL       │  │
│  └──────────────────────────────────┘  │
│              │                           │
│              ▼                           │
│  ┌──────────────────────────────────┐  │
│  │   PostgreSQL Database             │  │
│  │   - Persistent data storage       │  │
│  │   - Prisma ORM                    │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### **Why This Works:**

1. **Single Service to Manage**
   - One deployment pipeline
   - One health check
   - Simpler monitoring

2. **Cost Effective**
   - One service instead of two
   - Shared resources

3. **Data Persistence**
   - PostgreSQL database (separate service)
   - All data stored persistently
   - Can scale database independently

4. **Scalability Path**
   - Start with combined deployment
   - Split frontend/backend later if needed
   - Database can scale separately

---

## Deployment Platforms Comparison

### **1. Railway.app (Current Choice) ✅ Recommended**

**Pros:**
- Excellent monorepo support
- Generous free tier ($5/month credits)
- Easy PostgreSQL setup
- Simple JSON configuration
- Better build caching
- Auto-deploys on push
- Built-in SSL

**Cons:**
- Less mature than Render
- Smaller community

**Best For:** MVP, small-to-medium scale, monorepo projects, cost-effective start

**Setup:**
- One web service (API + Frontend combined)
- One PostgreSQL database
- Environment variables for config
- Uses `railway.json` for configuration

### **2. Render.com**

**Pros:**
- More mature platform
- Better documentation
- Blueprint deployment (multiple services from one file)
- Free tier available

**Cons:**
- Free tier has limitations (sleeps after inactivity)
- Build timeouts on free tier
- YAML configuration (more complex)

**Best For:** Alternative to Railway, when you need blueprint deployments

### **3. Vercel (Frontend) + Railway/Render (API)**

**Pros:**
- Vercel excellent for React apps
- Global CDN for frontend
- Fast static asset delivery

**Cons:**
- Two services to manage
- More complex setup
- Higher cost

**Best For:** High-traffic, global audience

### **4. AWS / Google Cloud / Azure**

**Pros:**
- Maximum scalability
- Enterprise-grade
- Full control

**Cons:**
- Complex setup
- Higher cost
- Steeper learning curve

**Best For:** Enterprise scale, high traffic, specific compliance needs

---

## Recommended Deployment Setup

### **For Your Scalable Platform:**

#### **Phase 1: MVP (Now)**
- **Platform:** Railway.app
- **Architecture:** Combined (API serves frontend)
- **Database:** Railway PostgreSQL
- **Cost:** Free tier ($5/month credits) to start

#### **Phase 2: Growth (100+ users)**
- **Platform:** Railway.app (upgrade to paid if needed)
- **Architecture:** Still combined, but optimize
- **Database:** Railway PostgreSQL (upgrade plan if needed)
- **Add:** CDN for static assets (Cloudflare)

#### **Phase 3: Scale (1000+ users)**
- **Platform:** Railway.app or AWS
- **Architecture:** Split frontend/backend
- **Frontend:** Vercel or Cloudflare Pages
- **API:** Railway or AWS ECS/Lambda
- **Database:** Managed PostgreSQL (AWS RDS, Railway, or Supabase)

---

## Current Deployment Configuration

### **Your Current Setup (railway.json):**

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

**This is correct!** Your API already serves the frontend in production (see `apps/api/src/index.ts:138-147`).

### **What Happens:**
1. Build process compiles both API and frontend
2. API starts and serves:
   - `/api/*` → API endpoints
   - `/*` → Static frontend files (React app)
3. Database connection via `DATABASE_URL`

---

## Data Persistence Strategy

### **PostgreSQL Database (Required)**

**Why PostgreSQL?**
- **Relational data:** Seasons, competitions, runs, users all relate
- **ACID compliance:** Data integrity for competition results
- **Complex queries:** Analytics require joins and aggregations
- **Prisma ORM:** Type-safe database access

**What Gets Stored:**
- User accounts and authentication
- Seasons and competitions
- Run results (time, penalties, notes)
- Run specifications (JSON)
- Penalty rules
- Analytics artifacts (cached results)
- Scenarios and adjustments

**Persistence Guarantees:**
- All data written to PostgreSQL
- Database backups (Render provides automatic backups)
- Migrations track schema changes
- Seed data for initial setup

---

## API Responsibilities Breakdown

### **1. Authentication & Authorization**
```typescript
// API handles:
- User login (password hashing, JWT generation)
- User registration (validation, role assignment)
- Token verification (middleware on protected routes)
- Role-based access (ADMIN can create, VIEWER can only read)
```

### **2. Data CRUD Operations**
```typescript
// API provides:
- Create competitions, seasons, run results
- Read/query with filtering (by season, run type, etc.)
- Update existing records
- Delete with proper authorization
```

### **3. Analytics Computation**
```typescript
// API computes:
- Competition trends (median clean times, penalty analysis)
- Run diagnostics (like-for-like comparisons)
- Performance drivers (top issues, recoverable time)
- Scenario simulations (what-if analysis)
```

### **4. Business Rules**
```typescript
// API enforces:
- Clean time calculation (totalTime - penaltyTime, never negative)
- Run type validation (A1, A3, A5, etc.)
- Penalty rule application
- Data consistency checks
```

### **5. Data Security**
```typescript
// API protects:
- Database credentials (never exposed to frontend)
- Sensitive operations (only ADMIN/COACH can modify)
- Input validation (Zod schemas)
- SQL injection prevention (Prisma ORM)
```

---

## Frontend Responsibilities

### **What the Frontend Does:**
- **User Interface:** React components, forms, charts
- **Data Display:** Shows data from API in readable format
- **User Interactions:** Buttons, filters, navigation
- **Client-Side Routing:** React Router for navigation
- **State Management:** Local state, API calls via axios

### **What the Frontend Does NOT Do:**
- ❌ Direct database access
- ❌ Heavy computations (done in API)
- ❌ Authentication logic (API handles)
- ❌ Data validation (API validates)

---

## Scaling Considerations

### **When to Split Frontend/Backend:**

**Keep Combined If:**
- < 1000 concurrent users
- Simple deployment needs
- Cost is a concern
- Team is small

**Split If:**
- > 1000 concurrent users
- Need global CDN for frontend
- Frontend and backend scale differently
- Multiple frontend apps (web, mobile API)

### **Database Scaling:**
- **Start:** Render PostgreSQL (free tier)
- **Grow:** Render PostgreSQL (paid, better performance)
- **Scale:** Managed PostgreSQL (AWS RDS, Supabase, Neon)
- **Enterprise:** Read replicas, connection pooling

---

## Recommended Deployment Steps

### **1. Fix Current Build Issues**

First, resolve the TypeScript errors in `apps/api/src/routes/analytics.ts`:

```typescript
// Error: 'orderBy' does not exist in CompetitionDefaultArgs
// Error: Property 'competition' does not exist on RunResult
```

These need to be fixed before deployment.

### **2. Railway Configuration**

Your `railway.json` is already configured correctly. Railway will:
- Automatically detect the configuration file
- Set up PostgreSQL database
- Configure environment variables
- Deploy on every push to main branch

**Environment Variables to Set in Railway Dashboard:**
- `NODE_ENV` = `production`
- `JWT_SECRET` = (generate random secret)
- `DATABASE_URL` = (automatically set by Railway from PostgreSQL service)

### **3. Environment Variables**

Set in Railway dashboard:
- `DATABASE_URL` (auto-set from PostgreSQL service)
- `JWT_SECRET` (you must generate and set this)
- `NODE_ENV` = `production`
- `PORT` (automatically set by Railway)

### **4. Build Process**

Railway will:
1. Clone your GitHub repo
2. Run `npm install`
3. Run `npm run db:generate` (Prisma client)
4. Run `npm run build` (builds API and frontend)
5. Run migrations (`npm run db:migrate:deploy`)
6. Start API server (`cd apps/api && npm start`)

---

## Alternative: Separate Frontend/Backend

If you want to split them later:

### **Frontend (Static Site):**
- **Platform:** Vercel, Netlify, or Cloudflare Pages
- **Build:** `cd apps/web && npm run build`
- **Deploy:** Upload `dist/` folder
- **Environment:** `VITE_API_URL=https://your-api.onrender.com/api`

### **Backend (API Only):**
- **Platform:** Render, Railway, or AWS
- **Build:** `cd apps/api && npm run build`
- **Deploy:** Node.js service
- **Environment:** Database connection, JWT secret

---

## Summary

### **For Your Scalable Sports Analytics Platform:**

1. **Yes, you need both Site and API**
   - API: Data persistence, business logic, security
   - Frontend: User interface, data visualization

2. **Current Architecture is Good**
   - Combined deployment works for MVP and growth
   - Can split later if needed
   - Database scales independently

3. **Recommended Deployment:**
   - **Platform:** Railway.app (start free, upgrade as needed)
   - **Architecture:** Combined (API serves frontend)
   - **Database:** Railway PostgreSQL (persistent, scalable)
   - **Cost:** Free tier ($5/month credits) to start, ~$5-20/month as you grow

4. **Data Persistence:**
   - PostgreSQL database (all data stored)
   - Automatic backups (Render provides)
   - Migrations track changes
   - Seed data for setup

5. **Scaling Path:**
   - Phase 1: Combined deployment (now)
   - Phase 2: Optimize combined (100+ users)
   - Phase 3: Split frontend/backend (1000+ users)

---

## Next Steps

1. **Fix build errors** in `apps/api/src/routes/analytics.ts`
2. **Update render.yaml** (remove unsupported fields)
3. **Test locally** (`npm run build` should succeed)
4. **Deploy to Railway** (connect GitHub repo)
5. **Monitor and scale** as needed

Your architecture is solid for a scalable platform. The combined deployment approach will serve you well through initial growth, and you can always split later if needed.
