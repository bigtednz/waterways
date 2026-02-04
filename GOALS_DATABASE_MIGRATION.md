# 🗄️ Goals Database Migration Guide

## Overview

The Goals System has been migrated from browser localStorage to PostgreSQL database persistence. This enables multi-device synchronization and provides a more robust storage solution.

## Migration Status

✅ **Migration Complete** - Database migration applied: `20260204065752_add_goals_system`

## What Changed

### Before (localStorage)
- Goals stored in browser localStorage
- Only available on the same device/browser
- Lost if browser cache cleared
- No user association

### After (Database)
- Goals stored in PostgreSQL database
- Syncs across all devices
- Persistent storage
- User-specific goals
- Automatic migration from localStorage

## For Users

### Automatic Migration

If you have goals stored in localStorage, the system will automatically prompt you to migrate them when you visit the dashboard:

1. Visit the Dashboard (`/app/dashboard`)
2. If localStorage goals are detected, you'll see a prompt
3. Click "OK" to migrate your goals to the database
4. Your goals will now sync across all devices

### Manual Migration

If you want to migrate goals manually:

1. Ensure you're logged in
2. Visit the Dashboard
3. The migration prompt will appear automatically
4. Or use the browser console: `checkAndMigrateGoals()`

### After Migration

- ✅ Goals are stored in the database
- ✅ Accessible from any device when logged in
- ✅ localStorage goals are automatically cleared after successful migration
- ✅ New goals are automatically saved to the database

## For Developers

### Database Schema

```prisma
model Goal {
  id              String              @id @default(cuid())
  userId          String
  type            GoalType
  title           String
  description     String?
  target          Float
  current         Float
  unit            String
  deadline        DateTime?
  seasonId        String?
  progress        Float               @default(0)
  status          GoalStatus          @default(NOT_STARTED)
  achievedAt      DateTime?
  autoUpdate      Boolean             @default(false)
  autoUpdateSource GoalAutoUpdateSource?
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  user            User                @relation(...)
  season          Season?             @relation(...)
  history         GoalHistory[]
}

model GoalHistory {
  id              String              @id @default(cuid())
  goalId          String
  date            DateTime            @default(now())
  current         Float
  progress        Float
  status          GoalStatus
  note            String?

  goal            Goal                @relation(...)
}
```

### API Endpoints

- `GET /api/goals` - Get all goals for authenticated user
- `GET /api/goals/:id` - Get a specific goal
- `POST /api/goals` - Create a new goal
- `PUT /api/goals/:id` - Update a goal
- `DELETE /api/goals/:id` - Delete a goal

### Frontend Changes

- `GoalsManager` now uses API instead of localStorage
- Conversion functions: `dbGoalToGoal()` and `goalToDbGoal()`
- Graceful fallback to localStorage if API unavailable
- Migration utility: `goalMigration.ts`

### Migration Script

The migration utility (`apps/web/src/lib/goalMigration.ts`) provides:

- `hasLocalStorageGoals()` - Check if localStorage goals exist
- `migrateGoalsToDatabase()` - Migrate goals to database
- `checkAndMigrateGoals()` - Prompt user and migrate

## Troubleshooting

### Goals Not Syncing

1. Check that you're logged in
2. Verify API server is running
3. Check browser console for errors
4. Ensure database migration was applied

### Migration Failed

1. Check browser console for error messages
2. Verify API endpoint is available (`/api/goals`)
3. Ensure you're authenticated
4. Try refreshing the page

### Fallback to localStorage

If the API is unavailable, the system automatically falls back to localStorage. This ensures backward compatibility but goals won't sync across devices.

## Benefits

✅ **Multi-device sync** - Access goals from any device  
✅ **Persistent storage** - Survives browser cache clears  
✅ **User-specific** - Each user has their own goals  
✅ **Scalable** - Database-backed architecture  
✅ **Backward compatible** - Falls back to localStorage if needed  

## Next Steps

1. ✅ Database migration applied
2. ✅ API endpoints created
3. ✅ Frontend updated
4. ✅ Migration utility implemented
5. ✅ Documentation updated

The Goals System is now fully database-backed and ready for production use!
