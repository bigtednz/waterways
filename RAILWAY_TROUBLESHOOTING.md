# Railway Troubleshooting Guide
## Fixing "Build Failed" When Database is Online

If you see:
- ✅ `waterways-db` is **Online** (green)
- ❌ `waterways-api` shows **Build failed** (red)

Follow these steps:

---

## Step 1: Check Build Logs

1. Click on the **`waterways-api`** service (the one showing "Build failed")
2. Go to the **"Deployments"** tab
3. Click on the **latest failed deployment**
4. Scroll through the logs to find the exact error

**Common errors you might see:**
- `DATABASE_URL resolved to an empty string` → Go to Step 2
- `Cannot find module '@waterways/db'` → Go to Step 3
- `Prisma Client not generated` → Go to Step 4
- TypeScript compilation errors → Go to Step 5

---

## Step 2: Fix DATABASE_URL Not Linked

**Symptoms:**
- Error: `DATABASE_URL resolved to an empty string`
- Database service is online, but API can't access it

**Solution:**

1. Click on **`waterways-api`** service
2. Go to **"Settings"** tab
3. Click **"Variables"** tab
4. Look for `DATABASE_URL` in the list

**If `DATABASE_URL` is missing or shows empty:**

1. Click **"New Variable"** button
2. Select **"Reference Variable"** (NOT "Raw Variable")
3. In the **"Service"** dropdown, select **`waterways-db`**
4. In the **"Variable"** dropdown, select **`DATABASE_URL`**
5. Click **"Add"**

**Verify:**
- `DATABASE_URL` should now appear in your variables list
- It should be **grayed out** (indicating it's a reference)
- The value should show a PostgreSQL connection string

**Then:**
- Go to **"Deployments"** tab
- Click **"Redeploy"** on the latest deployment

---

## Step 3: Fix Module Resolution Errors

**Symptoms:**
- Error: `Cannot find module '@waterways/db'`
- Error: `Cannot find module '@waterways/shared'`

**Solution:**

This usually means the build didn't complete properly. Check:

1. **Verify `railway.json` is correct:**
   ```json
   {
     "build": {
       "buildCommand": "npm install && npm run db:generate && npm run build"
     }
   }
   ```

2. **Check build logs** - Make sure `npm install` completed successfully

3. **Try redeploying** - Sometimes Railway needs a fresh build

---

## Step 4: Fix Prisma Client Not Generated

**Symptoms:**
- Error: `Prisma Client not generated`
- Error: `@prisma/client did not initialize yet`

**Solution:**

1. **Check `railway.json` includes `db:generate`:**
   ```json
   {
     "build": {
       "buildCommand": "npm install && npm run db:generate && npm run build"
     }
   }
   ```

2. **Verify build logs show:**
   ```
   > npm run db:generate
   > prisma generate
   ```

3. **If missing, the build command might not be running correctly**

---

## Step 5: Fix TypeScript Compilation Errors

**Symptoms:**
- TypeScript errors in build logs
- `error TS2307: Cannot find module`
- `error TS2322: Type 'X' is not assignable to type 'Y'`

**Solution:**

1. **Test locally first:**
   ```bash
   npm run build
   ```

2. **Fix any TypeScript errors locally**

3. **Commit and push:**
   ```bash
   git add .
   git commit -m "Fix TypeScript errors"
   git push
   ```

4. **Railway will auto-redeploy**

---

## Step 6: Verify Service Connection

**Check the connection arrow:**

1. In Railway dashboard, you should see:
   - `waterways-api` (top)
   - Arrow pointing down
   - `waterways-db` (bottom)

2. **If the arrow is missing:**
   - The services might not be properly connected
   - Try the DATABASE_URL linking in Step 2

---

## Step 7: Check Environment Variables

**Required variables for `waterways-api`:**

1. Go to **`waterways-api`** → **Settings** → **Variables**

2. **Required:**
   - `DATABASE_URL` (should be a reference to `waterways-db`)
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = (your secret string)

3. **Automatic (don't set manually):**
   - `PORT` (Railway sets this automatically)

**Verify all are set correctly.**

---

## Step 8: Manual Redeploy

If everything looks correct but still failing:

1. Go to **`waterways-api`** → **Deployments**
2. Click **"Redeploy"** on the latest deployment
3. Watch the logs in real-time
4. Note any new errors

---

## Common Build Phases

Your build should go through these phases:

1. ✅ **Install dependencies:** `npm install`
2. ✅ **Generate Prisma client:** `npm run db:generate`
3. ✅ **Build TypeScript:** `npm run build`
4. ✅ **Deploy migrations:** `npm run db:migrate:deploy` (needs DATABASE_URL)
5. ✅ **Start server:** `cd apps/api && npm start`

**If any phase fails, the build stops there.**

---

## Still Not Working?

1. **Check Railway status:** https://status.railway.app
2. **Check build logs** for the exact error message
3. **Try deleting and recreating** the API service
4. **Verify your `railway.json`** is committed to git
5. **Check your GitHub repo** - Railway pulls from there

---

## Quick Checklist

Before asking for help, verify:

- [ ] `waterways-db` is **Online** (green)
- [ ] `DATABASE_URL` is linked in `waterways-api` variables
- [ ] `NODE_ENV` = `production` is set
- [ ] `JWT_SECRET` is set
- [ ] `railway.json` exists in your repo root
- [ ] Build logs show where it's failing
- [ ] All code is committed and pushed to GitHub

---

## Success Indicators

When everything is working, you should see:

1. ✅ `waterways-api` shows **"Active"** (green)
2. ✅ Latest deployment shows **"Deployed"** (green)
3. ✅ Build logs show all phases completed
4. ✅ Your app is accessible at `https://your-app.railway.app`
5. ✅ `/health` endpoint returns `{"status":"ok"}`
