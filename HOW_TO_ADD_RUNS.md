# How to Add or Amend Runs

This guide explains how to add, edit, and delete run results in Big Teds Sports Analytics Platform.

## Overview

Run results represent the actual performance data for each run type (A1, A3, A5, etc.) within a competition. Each run result contains:
- **Total Time**: The complete time including penalties
- **Penalty Time**: Time added due to rule violations
- **Clean Time**: Calculated as `Total Time - Penalty Time`
- **Notes**: Optional notes about the run

## Method 1: Using the Competition Detail Page (Recommended)

### Adding Runs to a Competition

1. **Navigate to Competitions**
   - Go to the "Competitions" page from the sidebar
   - Click on the competition you want to add runs to

2. **Use Quick Entry Form**
   - Scroll down to the "Quick Entry" section
   - You'll see a table with all 9 run types (A1, A3, A5, A7, F9, F11, P13, P15, P17)
   - For each run type, enter:
     - **Total Time (s)**: The total time in seconds (e.g., `125.5`)
     - **Penalty (s)**: Penalty time in seconds (e.g., `5.0` or `0` if no penalties)
     - **Notes**: Optional notes about the run

3. **Save Runs**
   - Click the "Save All Runs" button at the bottom
   - The system will:
     - **Create** new runs for run types that don't have results yet
     - **Update** existing runs if they already exist
     - Reload the page to show the updated results

### Editing Existing Runs

1. **Navigate to Competition**
   - Go to the competition detail page
   - Existing runs are shown in the "Current Results" table below

2. **Update in Quick Entry**
   - The Quick Entry form is pre-filled with existing run data
   - Modify the values you want to change
   - Click "Save All Runs" to update

3. **Delete Individual Runs**
   - In the "Current Results" table, click the "Delete" button next to any run
   - Confirm the deletion
   - The run will be removed immediately

## Method 2: Using the API Directly

### Create Single Run Result

**POST `/api/run-results`**

Requires: ADMIN or COACH role

```json
{
  "competitionId": "clx...",
  "runTypeId": "clx...",
  "totalTimeSeconds": 125.5,
  "penaltySeconds": 5.0,
  "notes": "Optional notes"
}
```

**Example using curl:**
```bash
curl -X POST http://localhost:3001/api/run-results \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "competitionId": "clx...",
    "runTypeId": "clx...",
    "totalTimeSeconds": 125.5,
    "penaltySeconds": 5.0,
    "notes": "Good run, minor penalty"
  }'
```

### Bulk Create Run Results

**POST `/api/run-results/bulk`**

Requires: ADMIN or COACH role

This is the recommended method for adding multiple runs at once:

```json
{
  "competitionId": "clx...",
  "runs": [
    {
      "runTypeCode": "A1",
      "totalTimeSeconds": 125.5,
      "penaltySeconds": 5.0,
      "notes": "Run A1 notes"
    },
    {
      "runTypeCode": "A3",
      "totalTimeSeconds": 118.2,
      "penaltySeconds": 0,
      "notes": "Clean run"
    },
    {
      "runTypeCode": "A5",
      "totalTimeSeconds": 132.8,
      "penaltySeconds": 10.0
    }
  ]
}
```

**Example using curl:**
```bash
curl -X POST http://localhost:3001/api/run-results/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "competitionId": "clx...",
    "runs": [
      {"runTypeCode": "A1", "totalTimeSeconds": 125.5, "penaltySeconds": 5.0},
      {"runTypeCode": "A3", "totalTimeSeconds": 118.2, "penaltySeconds": 0}
    ]
  }'
```

### Update Existing Run Result

**PUT `/api/run-results/:id`**

Requires: ADMIN or COACH role

```json
{
  "totalTimeSeconds": 120.0,
  "penaltySeconds": 3.0,
  "notes": "Updated notes"
}
```

All fields are optional - only include what you want to change.

**Example using curl:**
```bash
curl -X PUT http://localhost:3001/api/run-results/clx... \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "totalTimeSeconds": 120.0,
    "penaltySeconds": 3.0
  }'
```

### Delete Run Result

**DELETE `/api/run-results/:id`**

Requires: ADMIN or COACH role

**Example using curl:**
```bash
curl -X DELETE http://localhost:3001/api/run-results/clx... \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Method 3: Using Prisma Studio (Database GUI)

1. **Open Prisma Studio**
   ```bash
   npm run db:studio
   ```

2. **Navigate to RunResult Table**
   - Click on "RunResult" in the left sidebar
   - Click "Add record" to create a new run

3. **Fill in Required Fields**
   - `competitionId`: Select from dropdown or paste ID
   - `runTypeId`: Select from dropdown or paste ID
   - `totalTimeSeconds`: Enter number (e.g., `125.5`)
   - `penaltySeconds`: Enter number (default: `0`)
   - `notes`: Optional text
   - `createdById`: Select user who created this

4. **Save**
   - Click "Save 1 change" button

## Getting Run Type IDs

To use the API, you'll need the `runTypeId`. You can get it by:

1. **Using the API:**
   ```bash
   GET /api/run-types
   ```
   Returns all run types with their IDs and codes.

2. **Using Run Type Code:**
   The bulk endpoint accepts `runTypeCode` (e.g., "A1", "A3") instead of `runTypeId`, which is more convenient.

## Important Notes

### Clean Time Calculation
- Clean time is automatically calculated as: `Math.max(0, totalTimeSeconds - penaltySeconds)`
- It's never negative (guarded against errors)

### Duplicate Prevention
- The system allows multiple runs of the same type in a competition
- However, for analytics purposes, you typically want one run per type per competition
- The Quick Entry form will update existing runs instead of creating duplicates

### Permissions
- **ADMIN** and **COACH** roles can create/edit/delete runs
- **VIEWER** role can only view runs

### Data Validation
- `totalTimeSeconds` must be positive (> 0)
- `penaltySeconds` must be non-negative (>= 0)
- `runTypeCode` must match an existing run type (A1, A3, A5, A7, F9, F11, P13, P15, P17)

## Workflow Example

### Adding All 9 Runs to a New Competition

1. Create the competition (if not already created)
2. Go to the competition detail page
3. In Quick Entry, fill in all 9 run types:
   ```
   A1: 125.5s total, 5.0s penalty
   A3: 118.2s total, 0s penalty
   A5: 132.8s total, 10.0s penalty
   A7: 115.0s total, 0s penalty
   F9: 140.3s total, 15.0s penalty
   F11: 128.7s total, 0s penalty
   P13: 135.9s total, 8.0s penalty
   P15: 122.4s total, 0s penalty
   P17: 130.1s total, 5.0s penalty
   ```
4. Click "Save All Runs"
5. All runs are created and analytics are automatically updated

### Updating a Single Run

1. Go to competition detail page
2. Find the run in Quick Entry (it's pre-filled)
3. Change the values
4. Click "Save All Runs"
5. The existing run is updated (not duplicated)

### Correcting a Mistake

1. Go to competition detail page
2. Option A: Update in Quick Entry and save
3. Option B: Delete the run from "Current Results" table, then add the correct one

## Troubleshooting

### "Failed to save runs" Error
- Check that you're logged in as ADMIN or COACH
- Verify the competition exists
- Ensure run type codes are valid (A1, A3, A5, etc.)
- Check that totalTimeSeconds is positive

### Duplicate Runs Created
- The bulk endpoint creates new runs each time
- Use the Quick Entry form which handles updates automatically
- Or manually delete old runs before creating new ones

### Can't See Runs After Saving
- The page reloads automatically after saving
- If runs don't appear, check the browser console for errors
- Verify the competition ID is correct

### Time Format
- Times are stored in **seconds** (not minutes:seconds)
- Example: `125.5` = 125.5 seconds = 2 minutes 5.5 seconds
- The UI displays times in readable format (e.g., "2:05.5")

## Best Practices

1. **Use Quick Entry for Multiple Runs**
   - Faster than creating runs one by one
   - Automatically handles updates vs creates

2. **Enter All 9 Runs**
   - Complete competitions provide better analytics
   - Missing runs won't affect analytics for other runs

3. **Include Notes**
   - Helpful for tracking special circumstances
   - Useful for post-competition analysis

4. **Verify Before Saving**
   - Double-check times and penalties
   - Ensure run types match the competition

5. **Review After Saving**
   - Check the "Current Results" table
   - Verify analytics update correctly

## Summary

- **Easiest Method**: Use Competition Detail Page → Quick Entry → Save All Runs
- **API Method**: Use POST `/api/run-results/bulk` for programmatic access
- **Database Method**: Use Prisma Studio for direct database access
- **Updates**: Quick Entry automatically updates existing runs
- **Deletes**: Use Delete button in Current Results table

The system is designed to make it easy to add and manage run results while maintaining data integrity and automatic analytics updates.
