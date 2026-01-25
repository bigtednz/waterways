# Troubleshooting "Failed to Load Run Types"

## Quick Checks

### 1. Is the API Server Running?
- Check if you see "Waterways API" window open
- Or check: `http://localhost:3001/health` or `http://localhost:3002/health` (see `API_PORT` in `apps/api/.env`) should return `{"status":"ok"}`
- If not running: `cd apps\api && npm run dev`

### 2. Is the Database Running?
- Check Docker: `docker ps` should show `waterways-db` container
- If not: `docker-compose up -d`

### 3. Does the Database Have Run Types?
- Open Prisma Studio: `npm run db:studio`
- Navigate to "RunType" table
- Should see 9 run types (A1, A3, A5, A7, F9, F11, P13, P15, P17)
- If empty: Run `npm run db:seed`

### 4. Is Authentication Working?
- Check browser console (F12) → Network tab
- Look for `/api/run-types` request
- Check if it has `Authorization: Bearer <token>` header
- Status code should be 200, not 401

### 5. Check Browser Console
- Open DevTools (F12)
- Look for error messages in Console tab
- Check Network tab for failed requests
- Look for CORS errors

## Common Issues

### Issue: 401 Unauthorized
**Cause:** Token expired or invalid
**Fix:** 
1. Log out and log back in
2. Check that `JWT_SECRET` in `.env` matches API server

### Issue: 404 Not Found
**Cause:** API endpoint not registered
**Fix:** 
1. Restart API server
2. Check `apps/api/src/index.ts` has `app.use("/api/run-types", runTypesRouter)`

### Issue: Network Error / CORS
**Cause:** API server not running or wrong URL
**Fix:**
1. Check `VITE_API_URL` in `.env` (should be `/api` for local dev)
2. Check API server is on port 3001 or 3002 (see `API_PORT` in `apps/api/.env`)
3. Check browser console for CORS errors

### Issue: Empty Array (No Run Types)
**Cause:** Database not seeded
**Fix:**
```bash
npm run db:seed
```

### Issue: Database Connection Error
**Cause:** PostgreSQL not running
**Fix:**
```bash
docker-compose up -d
# Wait a few seconds, then:
npm run db:migrate
npm run db:seed
```

## Debug Steps

1. **Check API Health:**
   ```bash
   curl http://localhost:3001/health
   # or http://localhost:3002/health if using API_PORT=3002
   ```

2. **Check Database:**
   ```bash
   npm run db:studio
   # Look for RunType table
   ```

3. **Check Authentication:**
   - Open browser DevTools → Application → Local Storage
   - Look for `token` key
   - Should have a JWT token value

4. **Test API Directly:**
   ```bash
   # Get token from browser localStorage, then:
   curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/run-types
   # use 3002 if API_PORT=3002 in apps/api/.env
   ```

5. **Check API Server Logs:**
   - Look at "Waterways API" window
   - Should see request logs
   - Check for error messages

## Build Failures

### Issue: "spawn EPERM" or "Error: spawn EPERM" (esbuild / Vite)
**Cause:** Windows permission or antivirus blocking Node from spawning the esbuild process.

**Fix (try in order):**
1. Run from a **normal Command Prompt or PowerShell** (not inside Cursor’s integrated terminal if it fails there).
2. Run `npm run build:fix-esbuild`, then `npm run build`.
3. Close other terminals, VS Code/Cursor, and file explorers using the project folder, then retry.
4. Temporarily disable real‑time antivirus for the project folder and retry.
5. Clean reinstall:
   ```bash
   rmdir /s /q node_modules
   del package-lock.json
   npm install
   npm run build
   ```

### Issue: "Failed to create APIClient: Unable to set up TLS" (Turbo)
**Cause:** Turbo’s remote cache can’t connect.

**Fix:** The root `npm run build` script now skips Turbo and runs `build:packages` then `build:apps` directly. If you use `turbo run build` yourself and see this, run `npm run build` instead.

## Reset Everything

If nothing works, reset the database:
```bash
reset-db.bat
```

Then restart servers:
```bash
start-local.bat
```
