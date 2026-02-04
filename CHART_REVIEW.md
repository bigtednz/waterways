# Chart Review & Improvements

## Current Charts Analysis

### 1. Status Breakdown (Pie Chart) ⚠️ **LOW VALUE**
**Current:** Shows RUN/PLANNED/SKIPPED distribution
**Issues:**
- Redundant - progress indicator already shows this
- Not actionable - doesn't help make decisions
- Static information that's visible elsewhere

**Recommendation:** Remove or replace with something more insightful

### 2. Time Distribution (Bar Chart) ✅ **MODERATE VALUE**
**Current:** Shows total time vs clean time for completed runs
**Issues:**
- Useful but could show more patterns
- Doesn't show trends or comparisons
- Missing context (is this good/bad?)

**Recommendation:** Enhance with:
- Add trend line showing if times are improving
- Show best/average/worst for comparison
- Group by event type (A vs F vs P)

### 3. Progress Timeline (Line Chart) ⚠️ **LOW VALUE**
**Current:** Shows cumulative completed runs over sequence
**Issues:**
- Redundant - just shows linear progression
- Not insightful - doesn't reveal patterns
- The gap between completed and total is obvious

**Recommendation:** Replace with:
- **Performance Over Time** - Show if times get worse as day progresses (fatigue)
- **Time vs Sequence** - Actual times plotted by sequence number

### 4. Penalty Analysis (Bar Chart) ✅ **GOOD VALUE**
**Current:** Shows penalty time per run
**Issues:**
- Useful but could show penalty as percentage
- Missing context on which events have most penalties

**Recommendation:** Enhance with:
- Show penalty percentage (not just absolute time)
- Group by event type to see patterns

## Recommended New Charts

### 1. **Performance Over Time** (High Value)
- X-axis: Sequence number
- Y-axis: Clean time
- Shows if performance degrades through the day (fatigue analysis)
- Can add trend line

### 2. **Team/Competitor Comparison** (High Value)
- Compare times across teams for same events
- Only show if multiple competitor times exist
- Helps identify best performers

### 3. **Event Type Performance** (Moderate Value)
- Group by event prefix (A, F, P)
- Show average clean time per event type
- Identify strengths/weaknesses

### 4. **Best vs Average** (Moderate Value)
- For each event, show best time vs average
- Highlights consistency vs peak performance

### 5. **Penalty Impact** (Enhanced)
- Show penalty as percentage of total time
- More meaningful than absolute seconds
- Helps prioritize which runs need penalty reduction focus

## Implementation Priority

1. **High Priority:**
   - Replace Progress Timeline with Performance Over Time
   - Add Team/Competitor Comparison (if data exists)
   - Enhance Penalty Analysis with percentages

2. **Medium Priority:**
   - Enhance Time Distribution with trends
   - Add Event Type Performance

3. **Low Priority:**
   - Remove or replace Status Breakdown
   - Add Best vs Average chart
