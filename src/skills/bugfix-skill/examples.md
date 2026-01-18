# Bug Fix Skill - Examples

> Few-shot examples demonstrating how to apply the Bug Fix Skill.

---

## Example 1: Simple Null Reference Bug

### Issue

```
Title: App crashes when user profile is empty
Labels: bug

Description:
When a new user logs in before filling out their profile, the dashboard
crashes with "Cannot read property 'name' of undefined".

Steps to reproduce:
1. Create a new account
2. Skip profile setup
3. Go to dashboard
4. App crashes

Error:
TypeError: Cannot read property 'name' of undefined
    at Dashboard.render (src/components/Dashboard.tsx:45)
```

### Agent Response

**Analysis:**
The error occurs in `Dashboard.tsx` at line 45. The code attempts to access
`user.profile.name` without checking if `profile` exists. New users who skip
profile setup have `user.profile = undefined`.

**Root Cause:**
Missing null check before accessing nested property.

**Fix:**
```typescript
// Before (line 45)
const displayName = user.profile.name;

// After
const displayName = user.profile?.name ?? 'New User';
```

**Actions Taken:**
1. Used `github.getFileContent` to read Dashboard.tsx
2. Identified missing optional chaining
3. Created fix with optional chaining and fallback value
4. Opened PR: "fix: handle missing user profile in dashboard"
5. Commented on issue explaining the fix

---

## Example 2: Off-by-One Pagination Bug

### Issue

```
Title: Last page of results shows duplicate items
Labels: bug, pagination

Description:
When viewing paginated results, the last page sometimes shows items that
were already on the previous page. Happens with lists that have exactly
10, 20, 30 items (multiples of page size).

Expected: Page 2 of 20 items shows items 11-20
Actual: Page 2 shows items 10-19 (item 10 duplicated)
```

### Agent Response

**Analysis:**
The pagination logic in `src/utils/pagination.ts` calculates offset incorrectly.
The formula uses `(page - 1) * pageSize - 1` instead of `(page - 1) * pageSize`.

**Root Cause:**
Off-by-one error in offset calculation, likely from a misunderstanding of
zero-indexed vs one-indexed page numbers.

**Fix:**
```typescript
// Before
function getOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize - 1;  // Wrong: subtracts 1
}

// After
function getOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;  // Correct: no extra subtraction
}
```

**Actions Taken:**
1. Read `pagination.ts` and related test file
2. Identified the off-by-one error
3. Fixed the formula
4. Updated test cases to cover edge cases (exact multiples of page size)
5. Opened PR with detailed explanation of the math

---

## Example 3: Race Condition Bug

### Issue

```
Title: Intermittent "item not found" errors during checkout
Labels: bug, critical

Description:
Sometimes checkout fails with "Item not found in cart" even though the
item is visible in the cart. Happens more often on slow connections.
Not reproducible consistently.

Error log:
[CartService] getItem: item_123 not found
[CheckoutService] Failed to process cart item
```

### Agent Response

**Analysis:**
This is a race condition. The checkout process reads the cart while the cart
update (from a previous action) is still in progress. The async operations
are not properly sequenced.

**Root Cause:**
`CartService.addItem()` is async but `CheckoutService.processCart()` doesn't
await the cart to be fully updated before reading.

**Fix:**
```typescript
// Before
async startCheckout() {
  this.cart.addItem(lastItem);  // Missing await!
  const items = await this.cart.getItems();
  return this.processCheckout(items);
}

// After
async startCheckout() {
  await this.cart.addItem(lastItem);  // Now properly awaited
  const items = await this.cart.getItems();
  return this.processCheckout(items);
}
```

**Actions Taken:**
1. Analyzed the flow between CartService and CheckoutService
2. Identified missing `await` keyword
3. Searched for similar patterns elsewhere (found 2 more instances)
4. Fixed all instances
5. Added integration test for checkout timing
6. Opened PR explaining the race condition

---

## Anti-Example: What NOT to Do

### Issue

```
Title: Button color is wrong on hover
Labels: bug, ui
```

### ❌ Bad Agent Response

"While fixing the button color, I also noticed the code could use some
refactoring. I've:
1. Fixed the button color (the actual bug)
2. Refactored the entire Button component to use styled-components
3. Added TypeScript types to all props
4. Created a new ButtonVariants enum
5. Updated 47 files that use the Button component
6. Added a new color theming system"

### Why This Is Wrong

- Scope creep: Only the color bug was reported
- Unnecessary refactoring: Not requested, not needed for the fix
- High risk: Touching 47 files for a hover color bug
- Breaking changes potential: New enum, new theming system

### ✅ Correct Approach

```css
/* Before */
.button:hover {
  background-color: #blue;  /* Invalid color value */
}

/* After */
.button:hover {
  background-color: #0066cc;  /* Valid hex color */
}
```

One line fix. Issue closed. Move on.

---

## Decision Tree

```
Is this a bug report?
├── No → Do not use this skill
└── Yes → Continue
    │
    Can I reproduce or understand the bug?
    ├── No → Ask clarifying questions via comment
    └── Yes → Continue
        │
        Is the fix straightforward?
        ├── Yes → Implement minimal fix, open PR
        └── No →
            │
            Does it require architectural changes?
            ├── Yes → Comment with analysis, suggest approach, wait for approval
            └── No → Break into smaller steps, fix incrementally
```
