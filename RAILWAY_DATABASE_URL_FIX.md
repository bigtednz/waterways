# Fix: DATABASE_URL Format Error on Railway

## The Problem

You have the correct connection string:
```
postgresql://postgres:VNyiepvqthhceoSZOfQUDKRkEWNzsfbO@postgres.railway.internal:5432/railway
```

But Prisma is still saying:
```
the URL must start with the protocol 'postgresql://' or 'postgres://'
```

This usually means:
1. The variable is stored incorrectly (as an object `{}` instead of a string)
2. There's whitespace or encoding issues
3. Railway is passing it in a different format

## Solution: Fix DATABASE_URL in Railway

### Step 1: Delete the Current DATABASE_URL

1. Go to `waterways-api` → Settings → Variables
2. Find `DATABASE_URL` in the list
3. Click the **delete/trash icon** (or three dots menu → Delete)
4. Confirm deletion

### Step 2: Add DATABASE_URL as a Raw String

1. Click **"New Variable"** button
2. **IMPORTANT:** Make sure you're adding a **"Raw Variable"** (not "Reference Variable")
3. Set:
   - **Variable Name:** `DATABASE_URL`
   - **Value:** `postgresql://postgres:VNyiepvqthhceoSZOfQUDKRkEWNzsfbO@postgres.railway.internal:5432/railway`
   - **Make sure:**
     - No quotes around it
     - No extra spaces
     - Copy/paste exactly as shown above
4. Click **"Add"**

### Step 3: Verify It's a String

After adding, `DATABASE_URL` should:
- Show as a string variable (not an object `{}`)
- Display the connection string (may be masked with asterisks)
- Not be grayed out (grayed out = reference variable)

### Step 4: Alternative - Use Public Hostname

If `postgres.railway.internal` doesn't work, Railway also provides a public hostname. Try this:

1. Go to `waterways-db` → Settings → Variables
2. Look for `DATABASE_URL` or check the "Connect" tab
3. Railway might show a public hostname like:
   ```
   postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway
   ```
4. Use that instead of `postgres.railway.internal`

### Step 5: Redeploy

1. Go to `waterways-api` → Deployments
2. Click **"Redeploy"**
3. Watch the logs - migration should now succeed!

## Why This Happens

Railway sometimes stores variables as JSON objects `{}` instead of plain strings, especially if you used "Add Reference" or if Railway auto-linked it incorrectly. Prisma needs a plain string value.

## Verification

After fixing, the build logs should show:
```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database
✅ Migration successful (no errors)
```

Instead of:
```
❌ Error: the URL must start with the protocol 'postgresql://' or 'postgres://'
```
