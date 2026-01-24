# Railway Deployment Guide
## Big Teds Sports Analytics Platform

This guide explains how to deploy your application to Railway.

---

## Quick Start

### 1. Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (recommended for easy repo connection)

### 2. Create New Project

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Connect your `waterways` repository
4. Railway will automatically detect the project

### 3. Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway automatically creates a `DATABASE_URL` environment variable
4. The database will be provisioned automatically

### 4. Configure Environment Variables

In your Railway service settings, add these environment variables:

**Required:**
- `NODE_ENV` = `production`
- `JWT_SECRET` = (generate a random secret, e.g., use `openssl rand -base64 32`)
- `DATABASE_URL` = (automatically set by Railway from PostgreSQL service)

**Optional:**
- `API_PORT` = `3001` (only needed if you want to override; Railway sets `PORT` automatically)

### 5. Deploy

Railway will automatically:
1. Detect `railway.json` configuration
2. Run build command: `npm install && npm run db:generate && npm run build`
3. Run start command: `npm run db:migrate:deploy && cd apps/api && npm start`
4. Deploy your application

**Note:** Railway auto-deploys on every push to your main branch.

---

## Railway Configuration

The `railway.json` file in your project root configures the deployment:

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

### What This Does:

1. **Build Process:**
   - Installs all npm dependencies
   - Generates Prisma client (`npm run db:generate`)
   - Builds the entire monorepo (`npm run build`)

2. **Deploy Process:**
   - Runs database migrations (`npm run db:migrate:deploy`)
   - Starts the API server (`cd apps/api && npm start`)

3. **Restart Policy:**
   - Automatically restarts on failure (up to 10 retries)

---

## Environment Variables

### Automatic Variables (Set by Railway)

- `PORT` - Railway automatically sets this to the port your service should listen on
- `DATABASE_URL` - Automatically set when you add a PostgreSQL database

### Required Variables (You Must Set)

1. **NODE_ENV**
   - Value: `production`
   - Purpose: Enables production optimizations

2. **JWT_SECRET**
   - Value: A random secret string (e.g., `openssl rand -base64 32`)
   - Purpose: Used to sign JWT authentication tokens
   - **Important:** Keep this secret! Never commit it to git.

### Optional Variables

- `API_PORT` - Only needed if you want to override the default port (Railway uses `PORT` by default)

---

## Database Setup

### Automatic Setup

When you add a PostgreSQL database in Railway:
1. Railway creates the database automatically
2. Sets `DATABASE_URL` environment variable
3. Your migrations run automatically on deploy (`npm run db:migrate:deploy`)

### Manual Database Access

If you need to access the database directly:

1. In Railway dashboard, click on your PostgreSQL service
2. Click **"Connect"** tab
3. Use the connection details to connect via:
   - Railway CLI: `railway connect`
   - psql: Use the connection string
   - Prisma Studio: `railway run npm run db:studio`

---

## Deployment Process

### What Happens on Deploy

1. **Build Phase:**
   ```bash
   npm install                    # Install dependencies
   npm run db:generate            # Generate Prisma client
   npm run build                  # Build TypeScript (API + Frontend)
   ```

2. **Deploy Phase:**
   ```bash
   npm run db:migrate:deploy      # Run database migrations
   cd apps/api && npm start       # Start API server
   ```

3. **Health Check:**
   - Railway monitors your service
   - Checks `/health` endpoint (if configured)
   - Restarts on failure

### Auto-Deploy

Railway automatically deploys when you:
- Push to your main/master branch
- Merge a pull request
- Manually trigger a deploy from the dashboard

---

## Monitoring & Logs

### View Logs

1. In Railway dashboard, click on your service
2. Click **"Deployments"** tab
3. Click on a deployment to see logs
4. Or use **"Logs"** tab for real-time logs

### Health Checks

Your API has a health endpoint at `/health`:
```bash
curl https://your-app.railway.app/health
# Returns: {"status":"ok"}
```

---

## Custom Domain

### Add Custom Domain

1. In Railway dashboard, click on your service
2. Go to **"Settings"** → **"Networking"**
3. Click **"Generate Domain"** or **"Add Custom Domain"**
4. Follow the DNS configuration instructions

### SSL/HTTPS

Railway automatically provides SSL certificates for:
- Generated Railway domains (`*.railway.app`)
- Custom domains (via Let's Encrypt)

---

## Troubleshooting

### Build Fails

**Error:** `Cannot find module '@waterways/db'`

**Solution:** Ensure `npm install` runs at the root level (Railway should do this automatically with `railway.json`)

**Error:** `Prisma Client not generated`

**Solution:** The build command includes `npm run db:generate`. Check that it's running successfully in build logs.

### Database Connection Fails

**Error:** `Can't reach database server`

**Solution:**
1. Verify PostgreSQL service is running in Railway
2. Check `DATABASE_URL` is set correctly
3. Ensure database service is in the same project as your web service

### Migration Fails

**Error:** `Migration failed`

**Solution:**
1. Check migration files are committed to git
2. Verify database is accessible
3. Check migration logs in Railway deployment logs

### Port Issues

**Error:** `Port already in use`

**Solution:** Railway sets `PORT` automatically. Your code should use:
```typescript
const PORT = process.env.PORT || process.env.API_PORT || 3001;
```

---

## Railway vs Render Comparison

### Railway Advantages

- ✅ Better monorepo support
- ✅ Simpler configuration (JSON vs YAML)
- ✅ More generous free tier
- ✅ Better build caching
- ✅ Easier database management

### Render Advantages

- ✅ Blueprint deployment (multiple services from one file)
- ✅ More mature platform
- ✅ Better documentation

---

## Cost

### Free Tier

Railway's free tier includes:
- $5/month in credits
- Enough for small-to-medium applications
- PostgreSQL database included

### Paid Plans

- **Starter:** $5/month + usage
- **Developer:** $20/month + usage
- **Team:** Custom pricing

**Note:** Your combined API + Frontend deployment uses one service, keeping costs low.

---

## Next Steps

1. **Deploy to Railway** using the steps above
2. **Test your deployment** by visiting your Railway URL
3. **Set up custom domain** (optional)
4. **Monitor logs** to ensure everything works
5. **Configure auto-deploy** (enabled by default)

---

## Support

- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **Railway Status:** https://status.railway.app

---

## Migration from Render

If you're migrating from Render:

1. **Export data** from Render PostgreSQL (if needed)
2. **Create Railway project** and add PostgreSQL
3. **Import data** to Railway PostgreSQL (if needed)
4. **Update environment variables** in Railway
5. **Deploy** - Railway will handle the rest

Your `render.yaml` file can remain in the repo for reference, but Railway will use `railway.json` instead.
