# Run Specifications Guide

## Overview

Run Specifications (`RunSpec`) are machine-readable, versioned specifications that define the procedures, requirements, and structure for each run type (A1, A3, A5, etc.). They serve as the "blueprint" for each run type, stored as flexible JSON that can be used for validation, documentation, and automated analysis.

## Database Structure

### RunSpec Model

```prisma
model RunSpec {
  id          String    @id @default(cuid())
  runTypeId   String
  version     String    @default("1.0.0")
  jsonSpec    Json      // Flexible JSON structure
  markdownPath String?   // Optional path to human-readable docs
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  runType     RunType   @relation(...)

  @@unique([runTypeId, version])  // One spec per run type per version
}
```

**Key Features:**
- **Versioned**: Multiple versions can exist per run type (latest is retrieved)
- **Flexible JSON**: `jsonSpec` can contain any structure you need
- **Optional Documentation**: `markdownPath` can point to human-readable docs
- **One-to-Many**: Each run type can have multiple spec versions

## How It Works

### 1. **Storage**
- Run specs are stored in the `run_specs` database table
- Each spec is linked to a specific `RunType` via `runTypeId`
- Multiple versions can exist (identified by `version` field)
- The API returns the **latest version** (sorted by version descending)

### 2. **API Endpoint**

**GET `/api/run-specs/:runTypeCode`**

Returns the latest specification for a run type:

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
      // Your custom JSON structure here
    },
    "markdownPath": "/docs/runs/A1.md"
  }
}
```

**If no spec exists:**
```json
{
  "runType": { ... },
  "spec": null
}
```

### 3. **Versioning System**

- Each spec has a `version` field (default: "1.0.0")
- Multiple versions can exist for the same run type
- The API automatically returns the latest version
- Use semantic versioning (e.g., "1.0.0", "1.1.0", "2.0.0")

**Example:**
- A1 v1.0.0: Initial spec
- A1 v1.1.0: Updated procedure steps
- A1 v2.0.0: Major restructure

The API will return v2.0.0 when querying A1.

## JSON Specification Structure

The `jsonSpec` field is **completely flexible** - you can structure it however you need. Here are some suggested structures:

### Example 1: Procedure-Based Structure

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

### Example 2: Rule-Based Structure

```json
{
  "runType": "A1",
  "rules": [
    {
      "id": "rule-1",
      "description": "Must follow order chain",
      "penalty": {
        "type": "time_penalty",
        "seconds": 5
      }
    },
    {
      "id": "rule-2",
      "description": "Equipment must be checked",
      "penalty": {
        "type": "disqualification"
      }
    }
  ],
  "checkpoints": [
    {
      "id": "cp-1",
      "name": "Start",
      "required": true
    },
    {
      "id": "cp-2",
      "name": "Mid-point",
      "required": true
    },
    {
      "id": "cp-3",
      "name": "Finish",
      "required": true
    }
  ]
}
```

### Example 3: Task-Oriented Structure

```json
{
  "runType": "A1",
  "tasks": [
    {
      "id": "task-1",
      "name": "Setup Equipment",
      "estimatedTime": 30,
      "dependencies": [],
      "critical": false
    },
    {
      "id": "task-2",
      "name": "Execute Run",
      "estimatedTime": 90,
      "dependencies": ["task-1"],
      "critical": true
    },
    {
      "id": "task-3",
      "name": "Cleanup",
      "estimatedTime": 15,
      "dependencies": ["task-2"],
      "critical": false
    }
  ],
  "totalEstimatedTime": 135
}
```

### Example 4: Comprehensive Structure

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

## Usage in the Application

### 1. **Run Library Page**
- Displays the JSON spec in a formatted view
- Shows the `markdownPath` if available
- Allows viewing specifications for each run type

### 2. **Potential Use Cases**

**Validation:**
- Validate run results against spec requirements
- Check if all required equipment was used
- Verify procedure steps were followed

**Documentation:**
- Store official procedure documentation
- Reference for training materials
- Automated documentation generation

**Analysis:**
- Compare actual performance to spec targets
- Identify deviations from standard procedure
- Calculate expected vs actual times

**Automation:**
- Generate training checklists
- Create validation rules
- Build procedure simulators

## Creating Run Specifications

### Via Database (Prisma Studio)

1. Open Prisma Studio: `npm run db:studio`
2. Navigate to `RunSpec` table
3. Create new record:
   - `runTypeId`: Select the run type
   - `version`: e.g., "1.0.0"
   - `jsonSpec`: Paste your JSON structure
   - `markdownPath`: Optional path to docs

### Via API (Future Enhancement)

Currently, there's no API endpoint to create/update run specs. You would need to:

1. Add POST/PUT endpoints to `apps/api/src/routes/runSpecs.ts`
2. Add validation schema in `packages/shared/src/schemas.ts`
3. Implement role-based access control (ADMIN/COACH)

### Example SQL Insert

```sql
INSERT INTO run_specs (id, "runTypeId", version, "jsonSpec", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  (SELECT id FROM run_types WHERE code = 'A1'),
  '1.0.0',
  '{"name": "Run A1", "phases": [...]}'::jsonb,
  NOW(),
  NOW()
);
```

## Best Practices

### 1. **Structure Consistency**
- Use consistent structure across all run types
- Define a schema/format for your organization
- Document the expected structure

### 2. **Versioning**
- Use semantic versioning (MAJOR.MINOR.PATCH)
- Increment version when making breaking changes
- Keep old versions for historical reference

### 3. **JSON Design**
- Keep it readable (use descriptive keys)
- Avoid deeply nested structures (max 3-4 levels)
- Include metadata (version, author, date)

### 4. **Documentation**
- Use `markdownPath` to link to detailed docs
- Include descriptions in JSON for quick reference
- Keep JSON and markdown in sync

### 5. **Validation**
- Consider adding JSON schema validation
- Validate structure before saving
- Use TypeScript types if processing in code

## Current Implementation Status

### ✅ Implemented
- Database model with versioning
- API endpoint to retrieve specs
- Display in Run Library page
- Version management (latest returned)

### ❌ Not Yet Implemented
- API endpoints to create/update specs
- JSON schema validation
- Spec comparison (between versions)
- Spec-based validation of run results
- Automated spec generation

## Future Enhancements

1. **CRUD API Endpoints**
   - POST `/api/run-specs` - Create spec
   - PUT `/api/run-specs/:id` - Update spec
   - GET `/api/run-specs/:runTypeCode/versions` - List all versions
   - GET `/api/run-specs/:runTypeCode/:version` - Get specific version

2. **Validation System**
   - Validate run results against spec
   - Check equipment requirements
   - Verify procedure compliance

3. **Spec Comparison**
   - Compare versions side-by-side
   - Show diff between versions
   - Track changes over time

4. **Integration with Analytics**
   - Use specs for expected time calculations
   - Identify procedure deviations
   - Generate compliance reports

## Summary

Run Specifications provide a flexible, versioned way to store machine-readable definitions of each run type. The `jsonSpec` field can contain any structure you need, making it adaptable to your specific requirements. Currently, specs are read-only through the API, but the infrastructure supports full CRUD operations when needed.

The system is designed to be:
- **Flexible**: Any JSON structure works
- **Versioned**: Track changes over time
- **Extensible**: Easy to add new features
- **Documented**: Optional markdown paths for human-readable docs
