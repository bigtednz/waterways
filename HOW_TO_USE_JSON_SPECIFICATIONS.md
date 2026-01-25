# How to Use JSON Specifications

## Overview

The JSON specification (`jsonSpec`) is the **machine-readable blueprint** for each run type. While the markdown provides human-readable documentation, the JSON spec enables programmatic validation, analysis, and automation.

## Current Implementation

### ✅ What's Available

1. **Storage & API**
   - JSON specs stored in database (`run_specs` table)
   - Access via API: `GET /api/run-specs/:runTypeCode`
   - View/edit in Admin page

2. **Validation Utilities** (New!)
   - `validateRunAgainstSpec()` - Validate run results
   - `compareToSpec()` - Compare actual vs expected performance
   - `getExpectedTimeFromSpec()` - Extract target times
   - `getProcedureStepsFromSpec()` - Extract procedure steps

3. **API Endpoint** (New!)
   - `GET /api/analytics/validate-run?runResultId=xxx` - Validate a specific run
   - `GET /api/analytics/validate-run?runTypeCode=A1` - Get spec info for a run type

## How to Use

### 1. **Validate a Run Result**

Validate a specific run against its specification:

```bash
GET /api/analytics/validate-run?runResultId=clx123...
```

**Response:**
```json
{
  "runType": { "code": "A1", "name": "Run A1" },
  "specVersion": "1.0.0",
  "runResult": {
    "id": "clx123...",
    "cleanTime": 125.5,
    "penaltySeconds": 10.0
  },
  "validation": {
    "isValid": true,
    "violations": [],
    "compliance": {
      "timeWithinLimits": true
    },
    "insights": [
      "Performance deviates 4.2% from target time (120s)"
    ]
  },
  "comparison": {
    "expectedTime": 120,
    "actualTime": 125.5,
    "timeDifference": 5.5,
    "timeDifferencePercent": 4.58,
    "withinTargetRange": true
  }
}
```

### 2. **Get Expected Time from Spec**

```typescript
import { getExpectedTimeFromSpec } from "@waterways/analytics-engine";

const spec = await fetch(`/api/run-specs/A1`).then(r => r.json());
const expectedTime = getExpectedTimeFromSpec(spec.spec.jsonSpec);
// Returns: 120 (if spec.timeLimits.target = 120)
```

### 3. **Compare Performance to Spec**

```typescript
import { compareToSpec } from "@waterways/analytics-engine";

const comparison = compareToSpec(
  { cleanTime: 125.5, penaltySeconds: 10 },
  spec.jsonSpec
);

console.log(comparison);
// {
//   expectedTime: 120,
//   actualTime: 125.5,
//   timeDifference: 5.5,
//   timeDifferencePercent: 4.58,
//   withinTargetRange: true
// }
```

### 4. **Extract Procedure Steps**

```typescript
import { getProcedureStepsFromSpec } from "@waterways/analytics-engine";

const steps = getProcedureStepsFromSpec(spec.jsonSpec);
// Returns array of phases/steps from the spec
```

## JSON Specification Structure

The JSON spec is **flexible** - you can structure it however you need. Here are common patterns:

### Pattern 1: Time Limits

```json
{
  "timeLimits": {
    "minimum": 60,
    "maximum": 180,
    "target": 120
  }
}
```

**Used for:**
- Validating if run times are within expected range
- Comparing actual vs target performance
- Flagging outliers

### Pattern 2: Procedure Phases

```json
{
  "procedure": {
    "phases": [
      {
        "phase": 1,
        "name": "Setup",
        "steps": ["Don equipment", "Check connections"],
        "timeLimit": 30
      },
      {
        "phase": 2,
        "name": "Execution",
        "steps": ["Begin water flow", "Complete objective"],
        "timeLimit": 90
      }
    ]
  }
}
```

**Used for:**
- Extracting expected procedure steps
- Calculating total expected time
- Generating training checklists

### Pattern 3: Penalty Thresholds

```json
{
  "penalties": {
    "maxAllowedSeconds": 30,
    "criticalViolations": ["equipment_failure", "safety_violation"]
  }
}
```

**Used for:**
- Validating penalty loads
- Flagging excessive penalties
- Identifying critical violations

### Pattern 4: Comprehensive Structure

```json
{
  "metadata": {
    "version": "1.0.0",
    "lastUpdated": "2024-01-15"
  },
  "timeLimits": {
    "target": 120,
    "minimum": 60,
    "maximum": 180
  },
  "procedure": {
    "phases": [...]
  },
  "requirements": {
    "equipment": {
      "mandatory": ["helmet", "hose"],
      "optional": ["gloves"]
    }
  }
}
```

## Integration Examples

### Example 1: Add Validation to Run Diagnostics

You could enhance the run diagnostics to include spec-based validation:

```typescript
// In analytics.ts
const diagnostic = computeRunDiagnostics(runResults);
const spec = await getRunSpec(runTypeCode);

if (spec) {
  const latestRun = runResults[runResults.length - 1];
  const validation = validateRunAgainstSpec(
    {
      cleanTime: latestRun.totalTimeSeconds - latestRun.penaltySeconds,
      penaltySeconds: latestRun.penaltySeconds,
    },
    spec.jsonSpec
  );
  
  diagnostic.validation = validation;
}
```

### Example 2: Show Expected Time in UI

In the Run Library page, you could display expected time from spec:

```typescript
const expectedTime = getExpectedTimeFromSpec(runSpec.spec.jsonSpec);
if (expectedTime) {
  // Display: "Target Time: 120s"
}
```

### Example 3: Automated Compliance Checking

When a run result is created, automatically validate it:

```typescript
// In runResults.ts route
const spec = await getRunSpec(runType.code);
if (spec) {
  const validation = validateRunAgainstSpec(
    { cleanTime, penaltySeconds },
    spec.jsonSpec
  );
  
  if (!validation.isValid) {
    // Flag for review or log violations
  }
}
```

## Next Steps

1. **Structure Your JSON Specs**
   - Add `timeLimits` with target/min/max
   - Add `procedure.phases` with steps
   - Add `penalties` thresholds

2. **Use Validation in Analytics**
   - Integrate into run diagnostics
   - Add to coaching summaries
   - Flag compliance issues

3. **Build Automation**
   - Generate training checklists from procedure steps
   - Create validation rules from spec
   - Build procedure simulators

## API Reference

### Validation Functions

**`validateRunAgainstSpec(runResult, spec)`**
- Validates run result against spec
- Returns violations, compliance, insights

**`compareToSpec(runResult, spec)`**
- Compares actual vs expected performance
- Returns time differences and percentages

**`getExpectedTimeFromSpec(spec)`**
- Extracts target/expected time from spec
- Returns number or null

**`getProcedureStepsFromSpec(spec)`**
- Extracts procedure phases/steps
- Returns array of steps

### API Endpoints

**`GET /api/analytics/validate-run?runResultId=xxx`**
- Validates a specific run result

**`GET /api/analytics/validate-run?runTypeCode=A1`**
- Returns spec information and expected values

## Summary

The JSON specification enables:
- ✅ **Validation** - Check runs against requirements
- ✅ **Analysis** - Compare actual vs expected
- ✅ **Automation** - Generate checklists, validate procedures
- ✅ **Insights** - Identify deviations and compliance issues

Start by structuring your JSON specs with `timeLimits` and `procedure.phases`, then use the validation utilities to check run results against the spec!
