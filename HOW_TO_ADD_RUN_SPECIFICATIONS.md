# How to Add Run Specifications

This guide explains how to add or update run specifications (RunSpec) for each run type in Big Teds Sports Analytics Platform.

## Overview

Run Specifications are machine-readable, versioned JSON definitions that describe the procedures, requirements, and structure for each run type (A1, A3, A5, etc.). They serve as the "blueprint" for each run type.

Each specification contains:
- **Version**: Semantic version (e.g., "1.0.0")
- **JSON Spec**: Flexible JSON structure defining the run
- **Markdown Path**: Optional path to human-readable documentation

## Method 1: Using Prisma Studio (Easiest)

### Step-by-Step Instructions

1. **Open Prisma Studio**
   ```bash
   npm run db:studio
   ```
   This opens a web interface at `http://localhost:5555`

2. **Navigate to RunSpec Table**
   - Click on "RunSpec" in the left sidebar

3. **Create New Specification**
   - Click the "Add record" button (top right)
   - Fill in the fields:

   **Required Fields:**
   - `runTypeId`: Click the dropdown and select the run type (e.g., "A1 - Run A1")
   - `version`: Enter version string (e.g., `1.0.0`)
   - `jsonSpec`: Paste your JSON specification (see examples below)

   **Optional Fields:**
   - `markdownPath`: Path to markdown documentation (e.g., `/docs/runs/A1.md`)

4. **Save**
   - Click "Save 1 change" button
   - The specification is now available via the API

### Getting Run Type IDs

If you need the `runTypeId`:
- In Prisma Studio, go to "RunType" table
- Find the run type code (A1, A3, etc.)
- Copy the `id` field

## Method 2: Using SQL Directly

### PostgreSQL Insert Statement

```sql
INSERT INTO run_specs (id, "runTypeId", version, "jsonSpec", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  (SELECT id FROM run_types WHERE code = 'A1'),
  '1.0.0',
  '{"name": "Run A1 - Attack Phase", "description": "Standard attack phase procedure", "phases": []}'::jsonb,
  NOW(),
  NOW()
);
```

### Using psql Command Line

```bash
psql -U postgres -d waterways -c "
INSERT INTO run_specs (id, \"runTypeId\", version, \"jsonSpec\", \"createdAt\", \"updatedAt\")
VALUES (
  gen_random_uuid(),
  (SELECT id FROM run_types WHERE code = 'A1'),
  '1.0.0',
  '{\"name\": \"Run A1\", \"phases\": []}'::jsonb,
  NOW(),
  NOW()
);
"
```

## Method 3: Using the API (After Implementation)

Once API endpoints are implemented, you'll be able to use:

### Create Specification

**POST `/api/run-specs`**

```json
{
  "runTypeCode": "A1",
  "version": "1.0.0",
  "jsonSpec": {
    "name": "Run A1 - Attack Phase",
    "description": "Standard attack phase procedure",
    "phases": [...]
  },
  "markdownPath": "/docs/runs/A1.md"
}
```

### Update Specification

**PUT `/api/run-specs/:id`**

```json
{
  "version": "1.1.0",
  "jsonSpec": {
    "name": "Run A1 - Updated",
    ...
  }
}
```

## JSON Specification Examples

### Example 1: Simple Structure

```json
{
  "name": "Run A1 - Attack Phase",
  "description": "Standard attack phase procedure for firefighting competition",
  "estimatedTime": 120,
  "difficulty": "Intermediate"
}
```

### Example 2: Procedure-Based Structure

```json
{
  "name": "Run A1 - Attack Phase",
  "description": "Standard attack phase procedure",
  "phases": [
    {
      "id": "phase-1",
      "name": "Setup",
      "duration": 30,
      "steps": [
        {
          "order": 1,
          "action": "Position equipment",
          "requirements": ["helmet", "hose", "nozzle"]
        },
        {
          "order": 2,
          "action": "Check connections",
          "requirements": ["all connections secure"]
        }
      ]
    },
    {
      "id": "phase-2",
      "name": "Execution",
      "duration": 90,
      "steps": [
        {
          "order": 1,
          "action": "Begin water flow",
          "critical": true
        }
      ]
    }
  ],
  "equipment": {
    "required": ["helmet", "hose", "nozzle"],
    "optional": ["gloves"]
  },
  "timeLimits": {
    "minimum": 60,
    "maximum": 180,
    "target": 120
  }
}
```

### Example 3: Comprehensive Structure

```json
{
  "metadata": {
    "version": "1.0.0",
    "lastUpdated": "2024-01-15",
    "author": "UFBA Rules Committee"
  },
  "overview": {
    "name": "Run A1 - Attack Phase",
    "description": "Standard attack phase procedure for firefighting competition",
    "category": "Attack",
    "difficulty": "Intermediate"
  },
  "procedure": {
    "phases": [
      {
        "phase": 1,
        "name": "Preparation",
        "steps": [
          "Don protective equipment",
          "Check equipment integrity",
          "Position at start line"
        ],
        "timeLimit": 30
      },
      {
        "phase": 2,
        "name": "Execution",
        "steps": [
          "Begin water flow",
          "Follow designated path",
          "Complete objective"
        ],
        "timeLimit": 90
      }
    ]
  },
  "requirements": {
    "equipment": {
      "mandatory": ["helmet", "hose", "nozzle"],
      "optional": ["gloves", "boots"]
    },
    "personnel": {
      "minimum": 2,
      "maximum": 4
    }
  },
  "penalties": {
    "orderViolation": {
      "seconds": 5,
      "description": "Per violation of order chain"
    },
    "equipmentFailure": {
      "seconds": 10,
      "description": "Missing or faulty equipment"
    }
  },
  "scoring": {
    "timeBased": true,
    "penaltyBased": true,
    "bonusPoints": false
  }
}
```

## Versioning

### Semantic Versioning

Use semantic versioning format: `MAJOR.MINOR.PATCH`

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes to structure
- **MINOR** (1.0.0 → 1.1.0): New features, backward compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, small updates

### Creating New Versions

1. **Create a new record** in Prisma Studio (don't edit the old one)
2. **Use the same `runTypeId`** but increment the `version`
3. **The API automatically returns the latest version**

Example:
- A1 v1.0.0: Initial spec
- A1 v1.1.0: Added new phase
- A1 v2.0.0: Major restructure

The API will return v2.0.0 when querying A1.

## Updating Existing Specifications

### Option 1: Create New Version (Recommended)

1. Keep the old version for historical reference
2. Create a new record with incremented version
3. Update the `jsonSpec` with your changes

### Option 2: Edit Existing Version

1. In Prisma Studio, find the specification
2. Click "Edit" button
3. Modify the `jsonSpec` field
4. Optionally update `version` if it's a significant change
5. Save changes

**Note:** Editing in place loses version history. Consider creating a new version instead.

## Workflow Example

### Adding Specifications for All 9 Run Types

1. **Prepare JSON files** for each run type (A1, A3, A5, A7, F9, F11, P13, P15, P17)

2. **Open Prisma Studio**
   ```bash
   npm run db:studio
   ```

3. **For each run type:**
   - Go to RunSpec table
   - Click "Add record"
   - Select run type from dropdown
   - Set version to "1.0.0"
   - Paste JSON specification
   - Save

4. **Verify in Run Library**
   - Go to Run Library page in the web app
   - Click on each run type
   - Verify the specification displays correctly

## Best Practices

### 1. Structure Consistency
- Use the same JSON structure across all run types
- Define a schema/format for your organization
- Document the expected structure

### 2. Versioning
- Always use semantic versioning
- Increment version when making breaking changes
- Keep old versions for historical reference

### 3. JSON Design
- Keep it readable (use descriptive keys)
- Avoid deeply nested structures (max 3-4 levels)
- Include metadata (version, author, date)

### 4. Documentation
- Use `markdownPath` to link to detailed docs
- Include descriptions in JSON for quick reference
- Keep JSON and markdown in sync

### 5. Validation
- Validate JSON before saving (use a JSON validator)
- Ensure required fields are present
- Test that the API returns the spec correctly

## Viewing Specifications

### In the Web App

1. Navigate to **Run Library** page
2. Click on any run type (A1, A3, etc.)
3. The specification is displayed in a formatted JSON viewer

### Via API

**GET `/api/run-specs/:runTypeCode`**

Example:
```bash
curl http://localhost:3001/api/run-specs/A1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "runType": {
    "id": "clx...",
    "code": "A1",
    "name": "Run A1"
  },
  "spec": {
    "id": "clx...",
    "version": "1.0.0",
    "jsonSpec": {
      "name": "Run A1 - Attack Phase",
      ...
    },
    "markdownPath": "/docs/runs/A1.md"
  }
}
```

## Troubleshooting

### "Run type not found" Error
- Verify the run type exists in the `run_types` table
- Check that you're using the correct `runTypeId` or `runTypeCode`

### JSON Validation Error
- Validate your JSON using a JSON validator (e.g., jsonlint.com)
- Ensure all strings are properly quoted
- Check for trailing commas

### Version Conflict
- The database has a unique constraint on `[runTypeId, version]`
- Each run type can only have one spec per version
- If you get a conflict, either:
  - Use a different version number
  - Delete the existing spec with that version

### Specification Not Appearing
- Verify the spec was saved successfully
- Check that the `runTypeId` matches an existing run type
- Ensure the API endpoint is working: `GET /api/run-specs/:runTypeCode`

### Can't Edit in Prisma Studio
- Make sure Prisma Studio is connected to the correct database
- Check database permissions
- Try refreshing the page

## Current Implementation Status

### ✅ Implemented
- Database model with versioning
- API endpoints to retrieve specs (GET)
- API endpoints to create specs (POST)
- API endpoints to update specs (PUT)
- API endpoints to delete specs (DELETE)
- List all versions of a spec
- Get specific version of a spec
- Display in Run Library page
- Version management (latest returned)
- Version conflict detection

### ❌ Not Yet Implemented
- JSON schema validation
- Spec comparison UI (between versions)
- Spec-based validation of run results
- Automated spec generation
- UI for creating/editing specs in web app

## Future Enhancements

Once API endpoints are implemented, you'll be able to:
- Create specs programmatically
- Update specs via API
- List all versions of a spec
- Get specific versions
- Validate JSON structure before saving

## Summary

**Easiest Method:** Use Prisma Studio
1. Run `npm run db:studio`
2. Go to RunSpec table
3. Add record with runTypeId, version, and jsonSpec
4. Save

**Alternative Methods:**
- SQL: Direct INSERT statements
- API: (Coming soon) POST/PUT endpoints

**Key Points:**
- Use semantic versioning (1.0.0, 1.1.0, 2.0.0)
- JSON structure is flexible - design what works for you
- Latest version is automatically returned by API
- Keep old versions for historical reference

The system is designed to be flexible - you can structure the JSON however you need for your specific requirements!
