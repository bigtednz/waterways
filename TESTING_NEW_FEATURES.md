# Testing Guide: Competition Day Enhancements

## Quick Start

1. Start the application:
   ```bash
   # Option 1: Use the batch file
   start-local.bat
   
   # Option 2: Manual start
   # Terminal 1 - API
   cd apps/api && npm run dev
   
   # Terminal 2 - Web
   cd apps/web && npm run dev
   ```

2. Login:
   - URL: http://localhost:3000
   - Email: `admin@waterways.com`
   - Password: `admin123`

3. Navigate to a Competition Day:
   - Go to "Competition Days" in the sidebar
   - Click on an existing competition day or create a new one

## Testing Checklist

### ✅ Phase 1: Foundation Improvements

#### Toast Notifications
- [ ] Add an event → Should see green success toast (top-right)
- [ ] Try to add invalid event → Should see red error toast
- [ ] Save times → Should see success toast
- [ ] Delete item → Should see success toast
- [ ] Toasts should auto-dismiss after a few seconds
- [ ] Multiple toasts should stack vertically
- [ ] Click X on toast → Should dismiss immediately

#### Confirmation Dialogs
- [ ] Click "Remove" (X button) on queue item → Should see confirmation dialog
- [ ] Click "Cancel" → Dialog closes, item not deleted
- [ ] Click "Confirm" → Item deleted, toast shown
- [ ] Press Escape → Dialog closes
- [ ] Try deleting competitor time → Should see confirmation dialog

#### Optimistic Updates
- [ ] Add event → Item appears immediately (before API completes)
- [ ] Change status (PLANNED → RUN) → Status changes immediately
- [ ] Move item up/down → Item moves immediately
- [ ] If API fails → Changes rollback, error toast shown
- [ ] Save times → Times update immediately in UI

#### Enhanced Loading States
- [ ] Click "Add" button → Button shows "..." while loading
- [ ] Click "Save Time" → Button shows "Saving..." 
- [ ] Click status button → Button shows "..." while updating
- [ ] Only the specific button should be disabled, not all buttons
- [ ] Mark competitor ran → Button shows "..." while loading

#### Inline Validation
- [ ] Enter negative total time → Red border, error message below
- [ ] Enter penalty > total time → Red border, error message
- [ ] Enter total time > 1000 → Error message
- [ ] Enter invalid split time → Error on that field
- [ ] Fix errors → Red border disappears, error message clears
- [ ] Try to save with errors → Toast error, times not saved

### ✅ Phase 2: UX Enhancements

#### Keyboard Shortcuts
- [ ] Press `?` → Keyboard help modal appears
- [ ] Press `Escape` → Modal closes
- [ ] Press `Ctrl/Cmd + K` → Custom event input focused
- [ ] Press `Ctrl/Cmd + S` while in time input → Saves current time entry
- [ ] Press `↑` or `↓` → Navigates between queue items
- [ ] Press `Enter` (not in input) → Marks focused item as RUN
- [ ] Press `Escape` → Closes dialogs, cancels editing

#### Progress Indicator
- [ ] View competition day with queue → Progress bar appears at top
- [ ] Progress shows: "X of Y runs completed (Z%)"
- [ ] Green bar fills based on percentage
- [ ] Status breakdown shows: RUN, PLANNED, SKIPPED counts
- [ ] As you mark items RUN → Progress updates in real-time

#### Smooth Animations
- [ ] Add item → Item slides in smoothly
- [ ] Change status → Color transition is smooth
- [ ] Expand/collapse item → Smooth height transition
- [ ] Toast appears → Slides in from right
- [ ] Focus queue item → Ring appears smoothly

#### Focus Management
- [ ] Navigate with arrow keys → Items get blue ring when focused
- [ ] Focused item scrolls into view automatically
- [ ] Click on item → Focus updates

## Test Scenarios

### Scenario 1: Complete Workflow
1. Create new competition day
2. Add 3 events using quick-add buttons
3. Add 1 custom event
4. Mark first event as RUN
5. Enter times for first event (total: 125.5, penalty: 5.0)
6. Save times → Should see success toast
7. Expand item → Should see split times section
8. Mark second event as RUN using keyboard (↑ then Enter)
9. Delete third event → Confirm in dialog
10. Check progress bar → Should show 2 of 3 completed (67%)

### Scenario 2: Error Handling
1. Try to save times with penalty > total time
2. Should see validation error, red border
3. Fix the values
4. Save → Should work
5. Disconnect network (or stop API)
6. Try to add event → Should see error toast, optimistic update rolls back

### Scenario 3: Keyboard Navigation
1. Press `?` to see shortcuts
2. Press `Ctrl+K` to focus custom input
3. Type "A2" and press Enter
4. Press `↓` to navigate to next item
5. Press `Enter` to mark as RUN
6. Press `Ctrl+S` while focused on time input → Should save

### Scenario 4: Bulk Operations (Future)
- Not yet implemented, will be in next phase

## Expected Behavior

### Toast System
- ✅ No more `alert()` popups
- ✅ All errors shown as toasts
- ✅ Success messages shown as toasts
- ✅ Toasts stack vertically
- ✅ Auto-dismiss after 5-7 seconds

### Optimistic Updates
- ✅ UI updates immediately (< 100ms perceived)
- ✅ Rollback on error with notification
- ✅ No flickering or loading states for simple actions

### Validation
- ✅ Real-time validation as you type
- ✅ Clear error messages
- ✅ Visual indicators (red borders)
- ✅ Prevents saving invalid data

## Known Issues / Notes

- Keyboard shortcuts work best when not focused in input fields
- Some shortcuts (Ctrl+S, Ctrl+K) work even in inputs for convenience
- Progress bar updates in real-time as you make changes
- All animations respect `prefers-reduced-motion` for accessibility

## Next Steps After Testing

If everything works:
- Continue with Phase 2: Bulk Operations
- Then Phase 3: Real-time, Offline, Voice, AI, Export
- Then Phase 4: Visualizations, Smart Defaults
- Then Phase 5: Performance, Accessibility, Mobile
