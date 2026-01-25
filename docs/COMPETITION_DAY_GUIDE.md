# Competition Day Feature Guide

## Overview

The Competition Day feature allows you to record and manage competition events on the day of competition. It provides a flexible run queue system where you can build the actual order of events as they happen, which may differ from the standard event schedule.

## Key Features

- **Flexible Event Order**: Build a queue in the actual order events are run
- **Event Status Tracking**: Mark events as PLANNED, RUN, or SKIPPED
- **Rerun Support**: Add additional attempts for the same event
- **Quick Actions**: Large, touch-friendly buttons for fast on-the-day use
- **Notes**: Add and edit notes for each queue item
- **Reorder**: Move events up or down in the queue

## Getting Started

### 1. Create a Competition Day

1. Navigate to **Competition Days** from the sidebar
2. Click **"New Competition Day"**
3. Fill in the form:
   - **Date**: Defaults to today (NZ timezone)
   - **Challenge Name**: e.g., "Spring Championship" (required)
   - **Location**: e.g., "National Waterways Center" (required)
   - **Track Name**: Optional (e.g., "Track A")
   - **Notes**: Optional notes about the competition day
4. Click **"Create & Build Queue"**

You'll be automatically redirected to the queue builder page.

### 2. Build Your Run Queue

#### Adding Events

**Quick Add Buttons:**
- Click any of the quick-add buttons (A1, A3, A5, A7, F9, F11, P13, P15, P17) to instantly add that event to the queue

**Custom Event Code:**
- Type any event code in the custom input field (e.g., A2, F10, P12)
- Press Enter or click "Add"
- Event codes are automatically converted to uppercase

#### Managing Queue Items

Each queue item shows:
- **Sequence Number**: The order in the queue (1, 2, 3...)
- **Event Code**: The event identifier (e.g., A1, F9)
- **Attempt Number**: Shows "(Attempt 2)" for reruns
- **Status Badge**: Color-coded status indicator
  - 🔵 **PLANNED**: Blue badge - Event is scheduled
  - 🟢 **RUN**: Green badge - Event has been completed
  - ⚪ **SKIPPED**: Gray badge - Event was skipped

**Available Actions:**

1. **Move Up/Down** (↑↓ arrows)
   - Reorder events in the queue
   - Automatically renumbers sequence numbers

2. **Status Toggle**
   - **Mark Run**: Changes PLANNED → RUN (green button)
   - **Mark Skipped**: Changes RUN → SKIPPED (gray button)
   - **Mark Planned**: Changes SKIPPED → PLANNED (blue button)

3. **Rerun** (Purple button)
   - Adds a new attempt for the same event
   - Automatically increments attempt number
   - Inserts immediately after the current item

4. **Edit Notes** (✏️ or "+ Notes")
   - Click to add or edit notes for the queue item
   - Type your notes and press Enter or click "Save"
   - Press Escape to cancel
   - Notes are useful for recording observations, issues, or reminders

5. **Remove** (Red X)
   - Removes the item from the queue
   - Confirmation dialog prevents accidental deletion
   - Automatically renumbers remaining items

## Workflow Example

### Before Competition

1. Create competition day with date, challenge, and location
2. Build initial queue using quick-add buttons for planned events
3. Add any custom events that aren't in the quick-add list
4. Reorder events to match the actual schedule (if known)

### During Competition

1. As events are about to run, mark them as **RUN** (green button)
2. If an event is skipped, mark it as **SKIPPED** (gray button)
3. Add notes for any important observations:
   - Click the ✏️ or "+ Notes" button
   - Type your note
   - Press Enter to save
4. If a rerun is needed:
   - Click **Rerun** on the completed event
   - The new attempt appears immediately after
   - Mark it as RUN when completed

### After Competition

- Review the queue to see the actual order of events
- Notes provide context for later analysis
- Status badges show what was completed vs skipped

## Tips for Fast Use

1. **Use Quick-Add Buttons**: For common events, use the quick-add buttons instead of typing
2. **Keyboard Shortcuts**: 
   - Press Enter in custom event input to add
   - Press Enter in notes field to save
   - Press Escape in notes field to cancel
3. **Touch-Friendly**: All buttons are sized for easy mobile use (minimum 44px height)
4. **Auto-Save**: All changes save automatically - no "Save" button needed
5. **Visual Feedback**: 
   - Green background = RUN
   - Gray background = SKIPPED
   - White background = PLANNED

## Technical Details

### Database Schema

- **CompetitionDay**: Stores competition day metadata
- **RunQueueItem**: Stores individual queue items with sequence numbers
- **RunQueueStatus**: Enum (PLANNED, RUN, SKIPPED)

### API Endpoints

- `POST /api/competition-days` - Create competition day
- `GET /api/competition-days` - List all competition days
- `GET /api/competition-days/:id` - Get competition day with queue
- `PUT /api/competition-days/:id` - Update competition day
- `POST /api/competition-days/:id/queue` - Add queue item
- `PUT /api/competition-days/queue/:id` - Update queue item
- `DELETE /api/competition-days/queue/:id` - Delete queue item
- `PUT /api/competition-days/:id/reorder` - Reorder queue items

### Sequence Number Management

- Sequence numbers are automatically managed
- When adding items, they're appended with the next available number
- When deleting, remaining items are renumbered
- When reordering, sequence numbers are updated to maintain 1..n order

## Future Enhancements

This feature is designed as a foundation for:
- Recording official times for each run
- Recording split times
- Recording penalties
- Recording competitor team results
- Linking queue items to run results

## Troubleshooting

**Can't add events?**
- Ensure you're logged in as ADMIN or COACH role
- Check that the competition day was created successfully

**Sequence numbers out of order?**
- Use the Move Up/Down buttons to reorder
- Or use the reorder endpoint if needed

**Notes not saving?**
- Make sure you press Enter or click Save
- Check your internet connection
- Look for error messages in the browser console

## Support

For issues or questions, use the **Support** button in the header to contact the development team.
