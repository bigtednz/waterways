# Railway Deployment Configuration Check

## ✅ Configuration Status

### 1. Railway Configuration (`railway.json`)
- **Builder**: NIXPACKS ✓
- **Build Command**: `npm install && npm run db:generate && npm run build && cd apps/api && npm run build`
  - Note: The final `cd apps/api && npm run build` is redundant since `npm run build` (Turbo) already builds all packages including the API, but it won't cause issues
- **Start Command**: `npm run db:migrate:deploy && cd apps/api && npm start` ✓
- **Restart Policy**: ON_FAILURE with 10 retries ✓

### 2. Build Process

#### Root Package (`package.json`)
- ✅ Workspaces configured: `apps/*`, `packages/*`
- ✅ Build script: `turbo run build` (builds all packages in correct order)
- ✅ Database scripts: `db:generate`, `db:migrate:deploy` ✓

#### Turbo Configuration (`turbo.json`)
- ✅ Build dependencies: `dependsOn: ["^build"]` ensures packages build in correct order
- ✅ Output directories: `dist/**` configured

#### Package Build Scripts
- ✅ `@waterways/shared`: Has `build` script
- ✅ `@waterways/analytics-engine`: Has `build` script
- ✅ `@waterways/db`: Has `build` script
- ✅ `@waterways/api`: Has `build` script + `prestart` script

### 3. TypeScript Configuration

#### Root (`tsconfig.json`)
- ✅ `moduleResolution: "node"` - Properly resolves workspace packages
- ✅ `noEmit: true` - Base config (overridden in packages)

#### API (`apps/api/tsconfig.json`)
- ✅ `noEmit: false` - Will emit compiled files
- ✅ `outDir: "./dist"` - Output directory configured
- ✅ `moduleResolution: "node"` - Proper module resolution

#### Packages
- ✅ All packages have `noEmit: false` to enable compilation
- ✅ All packages have proper `outDir` and `rootDir` configuration

### 4. Package Exports Configuration

All packages use conditional exports:
```json
{
  "main": "./src/index.ts",        // For TypeScript compilation
  "types": "./src/index.ts",       // For TypeScript type checking
  "exports": {
    ".": {
      "types": "./src/index.ts",   // TypeScript uses source
      "import": "./dist/index.js"   // Node.js uses compiled
    }
  }
}
```

This allows:
- ✅ TypeScript to resolve modules during compilation (uses source files)
- ✅ Node.js to use compiled files at runtime (via exports.import)

### 5. API Start Configuration

#### `apps/api/package.json`
- ✅ `prestart`: Automatically builds before starting (safety net)
- ✅ `start`: `node dist/index.js` - Runs compiled code
- ✅ Port handling: Uses `process.env.PORT` (Railway auto-sets this)

### 6. Environment Variables Required

#### Automatic (Set by Railway)
- ✅ `PORT` - Automatically set by Railway
- ✅ `DATABASE_URL` - Automatically set when PostgreSQL service is linked

#### Required (Must be set in Railway Dashboard)
- ⚠️ `JWT_SECRET` - Must be set manually (generate with `openssl rand -base64 32`)
- ⚠️ `NODE_ENV` - Should be set to `production`

### 7. Build Order (Handled by Turbo)

1. `@waterways/shared` builds first (no dependencies)
2. `@waterways/db` builds (depends on Prisma client generation)
3. `@waterways/analytics-engine` builds (depends on shared)
4. `@waterways/api` builds (depends on db, shared, analytics-engine)
5. `@waterways/web` builds (parallel, no API dependency)

## ⚠️ Potential Issues & Recommendations

### 1. Redundant Build Step
**Issue**: `railway.json` build command has `cd apps/api && npm run build` at the end, which is redundant since `npm run build` already builds everything.

**Recommendation**: Can be simplified to:
```json
"buildCommand": "npm install && npm run db:generate && npm run build"
```

However, keeping it doesn't hurt and provides an extra safety check.

### 2. Environment Variables
**Action Required**: Ensure these are set in Railway Dashboard:
- `JWT_SECRET` - Generate a secure random string
- `NODE_ENV=production`

### 3. Database Migrations
**Status**: ✅ Configured correctly
- `db:generate` runs during build (generates Prisma client)
- `db:migrate:deploy` runs before start (applies migrations)

### 4. Port Configuration
**Status**: ✅ Correctly configured
- API uses `process.env.PORT || process.env.API_PORT || 3001`
- Railway automatically sets `PORT` environment variable

## ✅ Deployment Checklist

- [x] Railway configuration file exists and is valid
- [x] All packages have build scripts
- [x] TypeScript configurations are correct
- [x] Package exports are configured for both compilation and runtime
- [x] Build order is handled by Turbo dependencies
- [x] API has prestart script as safety net
- [x] Database migrations are configured
- [ ] `JWT_SECRET` environment variable is set in Railway
- [ ] `NODE_ENV=production` is set in Railway
- [ ] PostgreSQL service is linked and `DATABASE_URL` is available

## 🚀 Deployment Process

1. **Build Phase**:
   - Install dependencies
   - Generate Prisma client
   - Build all packages (via Turbo)
   - Build API again (redundant but safe)

2. **Start Phase**:
   - Run database migrations
   - Start API server

3. **Runtime**:
   - Node.js uses compiled `dist/` files
   - All workspace packages resolve correctly via exports

## 📝 Notes

- The `prestart` script in API package.json provides an extra safety net in case the build phase didn't complete
- All packages use conditional exports to support both TypeScript compilation (source files) and Node.js runtime (compiled files)
- Turbo handles the build order automatically based on package dependencies
