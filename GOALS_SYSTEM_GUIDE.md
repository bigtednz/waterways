# 🎯 Goals System - Quick Start Guide

## How to Use the Goal Setting & Tracking System

### Step 1: Access the Goals Section

1. Navigate to the **Dashboard** page (`/app/dashboard`)
2. Scroll down to the **"Goals & Targets"** section
3. You'll see either:
   - An empty state with "Create Your First Goal" button (if no goals exist)
   - Your existing goals organized by status

### Step 2: Create Your First Goal

1. Click the **"+ New Goal"** button (top right of Goals section)
2. Fill in the form:
   - **Goal Title**: e.g., "Reduce median clean time to 120s"
   - **Description** (optional): Add more context
   - **Goal Type**: Choose from:
     - **Time Target**: Lower is better (e.g., achieve 120 seconds)
     - **Penalty Reduction**: Lower is better (e.g., reduce to 10 seconds total)
     - **Consistency/IQR**: Lower is better (e.g., achieve IQR of 5 seconds)
     - **Completion Rate**: Higher is better (e.g., achieve 90% completion)
   - **Current Value**: Your current performance
   - **Target Value**: What you want to achieve
   - **Season** (optional): Link goal to a specific season
   - **Deadline** (optional): When you want to achieve this goal
3. Click **"Create Goal"**

### Step 3: View Your Goals

Goals are displayed in three sections:

1. **Active Goals**: Goals that are in progress (on-track or at-risk)
2. **🏆 Achieved Goals**: Goals you've completed
3. **Other Goals**: Missed or not-started goals

### Step 4: Track Progress

- **Progress Bar**: Shows percentage completion (0-100%)
- **Status Badge**: 
  - 🟢 **On Track**: Progressing well
  - 🟡 **At Risk**: Needs attention
  - 🟢 **Achieved**: Goal completed!
  - 🔴 **Missed**: Deadline passed without completion
  - ⚪ **Not Started**: Just created

### Step 5: Update Goals

1. Click **"Edit"** on any goal card
2. Update the values (especially **Current Value** as you improve)
3. Click **"Update Goal"**
4. Progress and status update automatically

### Step 6: View Goals Overview

At the top of the Dashboard, you'll see a **"Goals Overview"** widget showing:
- Total active goals
- Number achieved
- On-track vs at-risk breakdown
- Recent progress for your active goals

---

## Example Goals

### Time Target Goal
- **Title**: "Achieve 120s median clean time"
- **Type**: Time Target
- **Current**: 135 seconds
- **Target**: 120 seconds
- **Progress**: Automatically calculated based on how close you are

### Penalty Reduction Goal
- **Title**: "Reduce total penalties to under 10s"
- **Type**: Penalty Reduction
- **Current**: 25 seconds
- **Target**: 10 seconds
- **Progress**: Shows reduction needed

### Consistency Goal
- **Title**: "Improve consistency to IQR of 5s"
- **Type**: Consistency/IQR
- **Current**: 12 seconds
- **Target**: 5 seconds
- **Progress**: Tracks improvement toward consistency

### Completion Rate Goal
- **Title**: "Achieve 95% completion rate"
- **Type**: Completion Rate
- **Current**: 80%
- **Target**: 95%
- **Progress**: Shows percentage toward target

---

## Troubleshooting

### Goals Not Showing?

1. **Check Browser Console**: Open DevTools (F12) and check for errors
2. **Check localStorage**: Goals are stored in browser localStorage under key `waterways_goals`
3. **Refresh Page**: Sometimes a refresh helps
4. **Clear and Recreate**: If corrupted, clear localStorage and recreate goals

### Progress Not Updating?

1. **Update Current Value**: Make sure you're updating the "Current Value" field
2. **Check Goal Type**: Different goal types calculate progress differently
3. **Refresh Page**: Progress recalculates on page load

### Can't Create Goals?

1. **Check Form Validation**: All required fields must be filled
2. **Check Browser Console**: Look for JavaScript errors
3. **Try Different Browser**: Sometimes browser extensions interfere

---

## Technical Details

### Data Storage
- ✅ Goals are stored in **PostgreSQL database** (primary)
- ✅ User-specific: Each user has their own goals
- ✅ Multi-device sync: Goals sync across all devices
- ✅ Fallback: Automatically falls back to localStorage if API unavailable
- ✅ Migration: Automatic migration utility for localStorage → database

### Database Schema
- **Goals Table**: Stores all goal data with user association
- **Goal History Table**: Tracks progress changes over time
- **Enums**: GoalType, GoalStatus, GoalAutoUpdateSource
- **Relations**: Goals linked to Users and Seasons

### Progress Calculation
- **Time/Penalty/Consistency**: Lower is better
  - 100% = Current ≤ Target
  - 0% = Current ≥ Target * buffer (1.2x to 2x depending on type)
- **Completion**: Higher is better
  - 100% = Current ≥ Target
  - 0% = Current = 0

### Status Calculation
- **Achieved**: Progress ≥ 100%
- **On Track**: Progress ≥ 75% or ahead of deadline schedule
- **At Risk**: Progress 50-75% or behind deadline schedule
- **Missed**: Deadline passed and progress < 100%
- **Not Started**: Progress < 50% and no deadline or early in timeline

---

## Next Steps

1. **Create Your First Goal**: Start with something achievable
2. **Update Regularly**: Update current values as you improve
3. **Set Deadlines**: Add deadlines for time-bound goals
4. **Link to Seasons**: Connect goals to specific seasons for better tracking
5. **Celebrate Achievements**: Check off completed goals!

---

## Tips for Success

- **Start Small**: Set achievable initial targets
- **Be Specific**: Clear, measurable goals work best
- **Update Often**: Regular updates keep progress accurate
- **Use Deadlines**: Time-bound goals create urgency
- **Review Regularly**: Check your goals overview weekly

---

## ✅ Completed Enhancements

- ✅ Auto-update goals from performance data
- ✅ Goal achievement notifications
- ✅ Goal templates for quick creation
- ✅ Goal history timeline
- ✅ API integration for cloud storage
- ✅ Database persistence with multi-device sync
- ✅ User-specific goal storage
- ✅ Automatic migration from localStorage

## Future Enhancements

- Goal sharing between users
- Goal analytics and insights
- Goal reminders and notifications
- Export goals to PDF/CSV
