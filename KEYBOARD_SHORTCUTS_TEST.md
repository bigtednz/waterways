# Keyboard Shortcuts Testing Guide

## Overview

The Competition Day Detail Page has several keyboard shortcuts to improve productivity and navigation. This guide will help you test all keyboard functionality.

## Prerequisites

1. Navigate to a Competition Day page: `http://localhost:3000/app/competition-days/[id]`
2. Make sure you have at least 2-3 queue items in the competition day
3. Have the page focused (click anywhere on the page, not in an input field)

## Keyboard Shortcuts

### 1. Show Keyboard Help (`?`)

**Test:**
- Press `?` key (without Ctrl/Cmd)
- **Expected:** A modal should appear showing all available keyboard shortcuts
- Press `Escape` to close the modal
- **Expected:** Modal closes

**Also accessible via:**
- Click the "⌨️ Shortcuts" button in the queue header

---

### 2. Focus Custom Event Input (`Ctrl/Cmd + K`)

**Test:**
- Press `Ctrl+K` (Windows/Linux) or `Cmd+K` (Mac)
- **Expected:** The custom event code input field should be focused and text selected
- Type an event code (e.g., "A2")
- Press `Enter`
- **Expected:** Event is added to the queue

**Works even when:**
- You're typing in other input fields
- You're focused on time inputs

---

### 3. Save Current Time Entry (`Ctrl/Cmd + S`)

**Test:**
1. Click on a queue item's "Total Time" input field
2. Enter a time (e.g., "125.5")
3. Press `Ctrl+S` (Windows/Linux) or `Cmd+S` (Mac)
4. **Expected:** 
   - The times are saved immediately
   - Success toast appears
   - Button shows "Saving..." briefly

**Works when:**
- Focused in any time input field (Total Time, Penalty, Split Times)
- Automatically detects which queue item you're editing

**Note:** This prevents the browser's default "Save Page" dialog

---

### 4. Navigate Between Queue Items (`↑` / `↓`)

**Test:**
1. Make sure you're NOT focused in any input field (click on the page background)
2. Press `↓` (Down Arrow)
3. **Expected:**
   - First queue item gets a blue focus ring
   - Item scrolls into view if needed
4. Press `↓` again
5. **Expected:**
   - Focus moves to the next queue item
   - Previous item loses focus ring
6. Press `↑` (Up Arrow)
7. **Expected:**
   - Focus moves back to previous item
   - Smooth scrolling

**Edge Cases:**
- At the top item, pressing `↑` should keep focus on first item
- At the bottom item, pressing `↓` should keep focus on last item
- If queue is empty, navigation should do nothing

---

### 5. Mark Item as RUN (`Enter`)

**Test:**
1. Navigate to a queue item using `↑` or `↓` (or click on an item)
2. Make sure the item status is "PLANNED"
3. Press `Enter` (while NOT in an input field)
4. **Expected:**
   - Item status changes to "RUN" immediately (optimistic update)
   - Success toast appears
   - Progress bar updates
   - Item background changes to green

**Note:** Only works when item status is "PLANNED". If already "RUN" or "SKIPPED", Enter does nothing.

---

### 6. Close Dialogs / Cancel Editing (`Escape`)

**Test Scenarios:**

**A. Close Confirmation Dialog:**
1. Click "Delete" (X button) on a queue item
2. Confirmation dialog appears
3. Press `Escape`
4. **Expected:** Dialog closes, item is NOT deleted

**B. Close Keyboard Help Modal:**
1. Press `?` to open keyboard help
2. Press `Escape`
3. **Expected:** Modal closes

**C. Cancel Notes Editing:**
1. Click "✏️" or "+ Notes" on a queue item
2. Start typing notes
3. Press `Escape`
4. **Expected:** Notes editing is cancelled, changes are discarded

**D. Close Any Open Dialog:**
- Works for all modals and dialogs in the page

---

## Complete Test Workflow

### Scenario 1: Quick Event Entry
1. Press `Ctrl+K` → Custom input focused
2. Type "A2" → Press `Enter` → Event added
3. Press `Ctrl+K` again → Type "F10" → Press `Enter` → Another event added
4. **Result:** Two events added quickly without using mouse

### Scenario 2: Navigate and Mark Complete
1. Press `↓` → First item focused (blue ring)
2. Press `Enter` → Item marked as RUN
3. Press `↓` → Second item focused
4. Press `Enter` → Second item marked as RUN
5. **Result:** Marked 2 items as complete using only keyboard

### Scenario 3: Enter Times Quickly
1. Press `↓` to focus first item
2. Click on "Total Time" input (or Tab to it)
3. Type "125.5"
4. Press `Tab` to move to "Penalty" input
5. Type "5.0"
6. Press `Ctrl+S` → Times saved
7. **Result:** Entered and saved times without clicking "Save Time" button

### Scenario 4: Keyboard Help Discovery
1. Press `?` → Help modal appears
2. Read through shortcuts
3. Press `Escape` → Modal closes
4. Try a shortcut you learned
5. **Result:** User discovers and uses shortcuts

---

## Expected Behavior

### Focus Management
- ✅ Focused items show blue ring (`ring-2 ring-blue-500`)
- ✅ Focused items scroll into view automatically
- ✅ Focus persists until you click elsewhere or navigate
- ✅ Focus works even when items are expanded/collapsed

### Keyboard Shortcuts
- ✅ All shortcuts work when page is focused
- ✅ Some shortcuts (Ctrl+S, Ctrl+K) work even in input fields
- ✅ Navigation shortcuts (↑/↓) only work when NOT in input fields
- ✅ Enter key only marks items when NOT in input fields

### Visual Feedback
- ✅ Focus ring appears smoothly (CSS transition)
- ✅ Status changes animate smoothly
- ✅ Toasts appear for all actions
- ✅ Loading states show on buttons

---

## Known Limitations

1. **Input Field Focus:**
   - When typing in an input field, arrow keys move cursor (normal behavior)
   - Must click outside input or press Tab to use navigation shortcuts
   - This is intentional to allow normal text editing

2. **Browser Shortcuts:**
   - `Ctrl+S` / `Cmd+S` is intercepted to save times instead of browser save
   - `Ctrl+K` / `Cmd+K` is intercepted to focus input (may conflict with browser search in some browsers)
   - These are common patterns in modern web apps

3. **Mobile:**
   - Keyboard shortcuts are primarily for desktop use
   - Mobile users can still use touch interactions
   - Some shortcuts may not work on mobile keyboards

---

## Troubleshooting

**Shortcuts not working?**
- Make sure the page is focused (click on the page background)
- Check browser console for errors (F12)
- Try refreshing the page
- Make sure you're not in an input field (for navigation shortcuts)

**Focus ring not showing?**
- Make sure you've navigated with arrow keys or clicked an item
- Check that the item is visible on screen
- Try scrolling to see if item is off-screen

**Enter key not marking items?**
- Make sure you're NOT in an input field
- Check that the focused item status is "PLANNED"
- Try clicking on the item first, then pressing Enter

---

## Quick Reference Card

```
?              → Show keyboard help
Ctrl/Cmd + K   → Focus custom event input
Ctrl/Cmd + S   → Save current time entry (when in time input)
↑ / ↓          → Navigate between queue items
Enter          → Mark focused item as RUN (if PLANNED)
Escape         → Close dialogs / Cancel editing
```

---

## Testing Checklist

- [ ] Press `?` → Help modal appears
- [ ] Press `Escape` → Help modal closes
- [ ] Press `Ctrl+K` → Custom input focused
- [ ] Type event code + Enter → Event added
- [ ] Press `↓` → First item gets focus ring
- [ ] Press `↓` again → Focus moves to next item
- [ ] Press `↑` → Focus moves back
- [ ] Press `Enter` on PLANNED item → Status changes to RUN
- [ ] Click time input → Type time → Press `Ctrl+S` → Times saved
- [ ] Click Delete button → Press `Escape` → Dialog closes
- [ ] Edit notes → Press `Escape` → Editing cancelled

---

## Next Steps

After testing keyboard shortcuts:
- Test other Phase 1 features (toasts, optimistic updates, validation)
- Test Phase 2 features (progress indicator, animations)
- Continue with remaining phases from the plan
