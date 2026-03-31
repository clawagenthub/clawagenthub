# Fix Overflow Issues in Mission Control

## Admin Role Setup

After registering a user, you need to promote them to admin role to access the Mission Control dashboard.

### SQL Command to Make User Admin

```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

Replace `your-email@example.com` with the actual email address of the user you want to promote.

### Alternative: Use the Promote Script

The project includes a script to promote users to admin:

```bash
node scripts/promote-to-admin.mjs your-email@example.com
```

---

## Problem Summary

The task detail modal and activity components have overflow issues where comments and activity content don't properly scroll within their containers. This causes the content to overflow the modal boundaries and look broken.

## Root Cause Analysis

### 1. ScrollArea Component Missing Overflow Styles
**Location:** [`src/components/ui/scroll-area.tsx`](../openclaw-mission-control/src/components/ui/scroll-area.tsx:19-24)

The Radix UI `ScrollAreaPrimitive.Viewport` component needs `overflow: hidden` to properly contain scrolling content. Currently, the viewport only has styling for focus states but lacks the critical overflow handling.

```tsx
// Current (line 19-24)
<ScrollAreaPrimitive.Viewport
  data-slot="scroll-area-viewport"
  className="focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1"
>
```

**Issue:** Without `overflow-hidden`, content can overflow the viewport boundaries.

### 2. TaskDetailModal Comments Section
**Location:** [`src/app/page.tsx`](../openclaw-mission-control/src/app/page.tsx:1327)

The comments section uses `ScrollArea` with `max-h-[250px]` but doesn't properly constrain the content:

```tsx
<ScrollArea className="max-h-[250px]" ref={scrollRef}>
  <div className="space-y-2">
    {comments.map((c) => (
      // Comment rendering
    ))}
  </div>
</ScrollArea>
```

**Issue:** The `max-h-[250px]` is applied to the ScrollArea root, but without proper overflow handling in the viewport, content can still overflow.

### 3. Individual Comment Content Overflow
**Location:** [`src/app/page.tsx`](../openclaw-mission-control/src/app/page.tsx:1345)

Each comment has nested overflow handling:

```tsx
<div className="text-foreground whitespace-pre-wrap leading-relaxed text-[13px] break-words overflow-auto max-h-[200px]">
  {c.content.length > 800 ? c.content.slice(0, 800) + "..." : c.content}
</div>
```

**Issue:** Using `overflow-auto` inside a ScrollArea creates nested scrolling, which is confusing UX and can break the layout. The content should flow naturally within the parent ScrollArea.

### 4. Live Terminal Activity Panel
**Location:** [`src/app/page.tsx`](../openclaw-mission-control/src/app/page.tsx:638)

The terminal uses ScrollArea but may have similar overflow issues:

```tsx
<ScrollArea className="flex-1">
  <div className="p-4 space-y-4 text-muted-foreground font-mono">
    {activity.map((entry, i) => (
      // Activity rendering
    ))}
  </div>
</ScrollArea>
```

**Issue:** Same root cause - viewport needs proper overflow handling.

## Solution Plan

### Step 1: Fix ScrollArea Component
Add `overflow-hidden` to the viewport to properly contain scrolling content.

**File:** `src/components/ui/scroll-area.tsx`
**Line:** 21

```tsx
<ScrollAreaPrimitive.Viewport
  data-slot="scroll-area-viewport"
  className="focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1 overflow-hidden"
>
```

### Step 2: Fix TaskDetailModal Comments Section
Ensure the ScrollArea has proper height constraints and the content flows naturally.

**File:** `src/app/page.tsx`
**Line:** 1316-1356

Changes needed:
1. Keep the `max-h-[250px]` on ScrollArea
2. Remove nested `overflow-auto` from individual comments
3. Let content flow naturally within the ScrollArea

```tsx
<div className="flex-1 space-y-2 min-h-0">
  <h4 className="text-sm font-medium text-muted-foreground">
    Activity ({comments.length})
  </h4>
  {loading ? (
    <div className="text-sm text-muted-foreground animate-pulse py-4 text-center">Loading...</div>
  ) : comments.length === 0 ? (
    <div className="text-sm text-muted-foreground py-4 text-center">
      No activity yet. Assign an agent to start working on this task.
    </div>
  ) : (
    <ScrollArea className="h-[250px]" ref={scrollRef}>
      <div className="space-y-2 pr-4">
        {comments.map((c) => (
          <div
            key={c.id}
            className={`p-3 rounded-md text-sm border ${
              c.author_type === "agent"
                ? "bg-primary/5 border-primary/20"
                : c.author_type === "system"
                ? "bg-blue-500/5 border-blue-500/20"
                : "bg-amber-500/5 border-amber-500/20"
            }`}
          >
            <div className={`text-[11px] font-bold uppercase mb-1 ${
              c.author_type === "agent" ? "text-primary" : c.author_type === "system" ? "text-blue-400" : "text-amber-500"
            }`}>
              {c.author_type === "agent" ? `🤖 ${c.agent_id || "Agent"}` : c.author_type === "system" ? "⚙️ System" : "👤 You"}
            </div>
            <div className="text-foreground whitespace-pre-wrap leading-relaxed text-[13px] break-words">
              {c.content}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {timeAgo(c.created_at)}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )}
</div>
```

**Key changes:**
- Changed `max-h-[250px]` to `h-[250px]` for fixed height
- Removed `overflow-auto max-h-[200px]` from comment content
- Removed content truncation (let full content display with scrolling)
- Added `pr-4` padding to inner div for scrollbar spacing

### Step 3: Verify Live Terminal
The terminal should work correctly once the ScrollArea component is fixed, but verify it's using proper height constraints.

**File:** `src/app/page.tsx`
**Line:** 638

Current implementation looks correct - it uses `flex-1` which allows it to fill available space.

## Testing Checklist

After implementing the fixes:

1. **Task Detail Modal**
   - [ ] Open a task with multiple comments
   - [ ] Verify comments scroll smoothly within the modal
   - [ ] Verify long comment content wraps and doesn't overflow
   - [ ] Verify modal doesn't expand beyond viewport
   - [ ] Test with very long comments (500+ characters)

2. **Live Terminal**
   - [ ] Open the terminal panel
   - [ ] Verify activity entries scroll properly
   - [ ] Verify new entries auto-scroll to bottom
   - [ ] Test with many activity entries (20+)

3. **General**
   - [ ] Test in different viewport sizes (mobile, tablet, desktop)
   - [ ] Verify scrollbars appear when needed
   - [ ] Verify no horizontal overflow
   - [ ] Check that nested content doesn't create double scrollbars

## Implementation Notes

### Why `overflow-hidden` on ScrollArea Viewport?

Radix UI's ScrollArea works by:
1. The root container defines the visible area
2. The viewport contains the scrollable content
3. The viewport needs `overflow: hidden` to clip content
4. Radix handles the actual scrolling via custom scrollbars

Without `overflow: hidden`, the browser's default overflow behavior takes over, breaking the custom scrollbar implementation.

### Why Remove Nested `overflow-auto`?

Having `overflow-auto` on individual comments inside a ScrollArea creates:
- Nested scrolling (scroll within scroll)
- Confusing UX (which scrollbar to use?)
- Layout issues (inner scroll can break outer scroll)
- Accessibility problems (screen readers struggle with nested scrolls)

Better approach: Let all content flow naturally within a single ScrollArea.

### Height Constraints

Using `h-[250px]` instead of `max-h-[250px]` provides:
- Consistent layout (doesn't jump when content changes)
- Predictable scrolling behavior
- Better visual stability in the modal

## Files to Modify

1. [`src/components/ui/scroll-area.tsx`](../openclaw-mission-control/src/components/ui/scroll-area.tsx) - Add overflow-hidden to viewport
2. [`src/app/page.tsx`](../openclaw-mission-control/src/app/page.tsx) - Fix TaskDetailModal comments section (lines 1316-1356)

## Expected Outcome

After implementing these fixes:
- Comments in task detail modal scroll smoothly within their container
- No content overflows the modal boundaries
- Activity in live terminal scrolls properly
- Single, intuitive scrollbar for each scrollable area
- Consistent behavior across all viewport sizes
