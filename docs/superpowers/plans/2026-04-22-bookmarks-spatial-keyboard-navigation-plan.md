# Bookmarks Spatial Keyboard Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace linear up/down-only bookmark keyboard selection with spatial card-grid navigation that captures all four arrow keys while search results are visible.

**Architecture:** Keep `App.vue` as the runtime coordinator, but keep navigation decisions inside `src/bookmarks/keyboardNavigation.js`. Add one pure geometry helper for card rects, then let `App.vue` collect current DOM card positions and update `highlightedIndex`.

**Tech Stack:** Vue 3, Vite 6, plain JavaScript helper modules, Node built-in `node:test`.

---

## File Structure

- Modify: `src/bookmarks/keyboardNavigation.js`
  - Owns pure keyboard behavior.
  - Extend `getKeyboardNavigationResult` so all arrow keys are move actions and are prevented.
  - Add `getSpatialNavigationIndex` for rect-based movement.
- Modify: `tests/preload/keyboardNavigation.test.mjs`
  - Covers arrow-key interception, spatial movement, row boundaries, first/last boundaries, and invalid rect input.
- Modify: `src/bookmarks/HomeView.vue`
  - Add `data-bookmark-card-key` to each card wrapper so `App.vue` can map rendered DOM back to `visibleEntries`.
- Modify: `src/App.vue`
  - Import `getSpatialNavigationIndex`.
  - Add a small DOM rect collector.
  - Use spatial navigation for arrow keys before updating `highlightedIndex`.
- Modify: `AGENTS.md`
  - Update the current keyboard-navigation capability and smoke checklist after implementation.

## Task 1: Lock Arrow-Key Decision Behavior

**Files:**
- Modify: `tests/preload/keyboardNavigation.test.mjs`
- Modify: `src/bookmarks/keyboardNavigation.js`

- [ ] **Step 1: Add failing tests for four-arrow interception**

Replace the top import in `tests/preload/keyboardNavigation.test.mjs` with:

```js
import { getKeyboardNavigationResult, getSpatialNavigationIndex } from '../../src/bookmarks/keyboardNavigation.js'
```

Append these tests to `tests/preload/keyboardNavigation.test.mjs`:

```js
test('all arrow keys move the highlight and prevent sub input cursor movement', () => {
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
    const result = getKeyboardNavigationResult({
      key,
      currentView: 'home',
      loading: false,
      hasError: false,
      highlightedIndex: 2,
      entryCount: 5,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
    })

    assert.equal(result.action, 'move')
    assert.equal(result.preventDefault, true)
    assert.equal(result.subInputBehavior, 'preserve')
  }
})

test('arrow keys do not intercept when the shortcut should stay with the system or input', () => {
  const base = {
    key: 'ArrowRight',
    currentView: 'home',
    loading: false,
    hasError: false,
    highlightedIndex: 0,
    entryCount: 3,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
  }

  const cases = [
    { ...base, currentView: 'settings' },
    { ...base, loading: true },
    { ...base, hasError: true },
    { ...base, entryCount: 0 },
    { ...base, metaKey: true },
    { ...base, ctrlKey: true },
    { ...base, altKey: true },
  ]

  for (const input of cases) {
    assert.deepEqual(getKeyboardNavigationResult(input), {
      action: 'noop',
      nextIndex: input.highlightedIndex,
      preventDefault: false,
      subInputBehavior: 'none',
    })
  }
})
```

- [ ] **Step 2: Run the targeted test and verify it fails**

Run:

```bash
node --test tests/preload/keyboardNavigation.test.mjs
```

Expected:

- Fails because `getSpatialNavigationIndex` is not exported yet.
- Or fails because `ArrowLeft` / `ArrowRight` currently return `noop`.

- [ ] **Step 3: Update arrow-key decision logic**

In `src/bookmarks/keyboardNavigation.js`, replace the separate `ArrowDown` and `ArrowUp` branches with:

```js
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
    return {
      action: 'move',
      nextIndex: highlightedIndex,
      preventDefault: true,
      subInputBehavior: 'preserve',
    }
  }
```

Do not add spatial movement inside this function. It only decides whether the app owns the key.

- [ ] **Step 4: Run the targeted test again**

Run:

```bash
node --test tests/preload/keyboardNavigation.test.mjs
```

Expected:

- Still fails until `getSpatialNavigationIndex` is implemented in Task 2.
- The `ArrowLeft` / `ArrowRight` decision assertions should no longer be the failing reason.

- [ ] **Step 5: Do not commit yet**

Do not commit after Task 1. Task 1 deliberately leaves the import for `getSpatialNavigationIndex` failing so Task 2 can complete the unit.

## Task 2: Implement Pure Spatial Navigation

**Files:**
- Modify: `tests/preload/keyboardNavigation.test.mjs`
- Modify: `src/bookmarks/keyboardNavigation.js`

- [ ] **Step 1: Add rect fixtures and spatial tests**

Append this helper and tests to `tests/preload/keyboardNavigation.test.mjs`:

```js
function rect(index, left, top, width = 100, height = 60) {
  return {
    cardKey: `card-${index}`,
    index,
    left,
    right: left + width,
    top,
    bottom: top + height,
    centerX: left + width / 2,
    centerY: top + height / 2,
  }
}

const gridRects = [
  rect(0, 0, 0),
  rect(1, 110, 0),
  rect(2, 220, 0),
  rect(3, 0, 70),
  rect(4, 110, 70),
  rect(5, 220, 70),
  rect(6, 0, 140),
]

test('ArrowRight selects the nearest card on the same row', () => {
  assert.equal(getSpatialNavigationIndex({
    key: 'ArrowRight',
    highlightedIndex: 1,
    rects: gridRects,
  }), 2)
})

test('ArrowLeft selects the nearest card on the same row', () => {
  assert.equal(getSpatialNavigationIndex({
    key: 'ArrowLeft',
    highlightedIndex: 1,
    rects: gridRects,
  }), 0)
})

test('ArrowRight at row end selects the next linear card', () => {
  assert.equal(getSpatialNavigationIndex({
    key: 'ArrowRight',
    highlightedIndex: 2,
    rects: gridRects,
  }), 3)
})

test('ArrowLeft at row start selects the previous linear card', () => {
  assert.equal(getSpatialNavigationIndex({
    key: 'ArrowLeft',
    highlightedIndex: 3,
    rects: gridRects,
  }), 2)
})

test('ArrowRight on the final card keeps the current selection', () => {
  assert.equal(getSpatialNavigationIndex({
    key: 'ArrowRight',
    highlightedIndex: 6,
    rects: gridRects,
  }), 6)
})

test('ArrowLeft on the first card keeps the current selection', () => {
  assert.equal(getSpatialNavigationIndex({
    key: 'ArrowLeft',
    highlightedIndex: 0,
    rects: gridRects,
  }), 0)
})

test('ArrowDown selects the closest horizontal card on the next visual row', () => {
  assert.equal(getSpatialNavigationIndex({
    key: 'ArrowDown',
    highlightedIndex: 1,
    rects: gridRects,
  }), 4)
})

test('ArrowUp selects the closest horizontal card on the previous visual row', () => {
  assert.equal(getSpatialNavigationIndex({
    key: 'ArrowUp',
    highlightedIndex: 4,
    rects: gridRects,
  }), 1)
})

test('ArrowUp on the top row keeps the current selection', () => {
  assert.equal(getSpatialNavigationIndex({
    key: 'ArrowUp',
    highlightedIndex: 1,
    rects: gridRects,
  }), 1)
})

test('ArrowDown on the bottom row keeps the current selection', () => {
  assert.equal(getSpatialNavigationIndex({
    key: 'ArrowDown',
    highlightedIndex: 6,
    rects: gridRects,
  }), 6)
})

test('spatial navigation keeps current selection when rect input is inconsistent', () => {
  assert.equal(getSpatialNavigationIndex({
    key: 'ArrowRight',
    highlightedIndex: 1,
    rects: [rect(0, 0, 0), rect(2, 220, 0)],
  }), 1)
})
```

- [ ] **Step 2: Run the targeted test and verify it fails**

Run:

```bash
node --test tests/preload/keyboardNavigation.test.mjs
```

Expected:

- Fails because `getSpatialNavigationIndex` does not exist yet.

- [ ] **Step 3: Implement the spatial helper**

Append this code to `src/bookmarks/keyboardNavigation.js`:

```js
const ROW_TOLERANCE_PX = 8

function isArrowKey(key) {
  return ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)
}

function hasConsistentRects(rects) {
  if (!Array.isArray(rects) || rects.length === 0) {
    return false
  }

  return rects.every((rect, index) =>
    rect &&
    rect.index === index &&
    Number.isFinite(rect.left) &&
    Number.isFinite(rect.right) &&
    Number.isFinite(rect.top) &&
    Number.isFinite(rect.bottom) &&
    Number.isFinite(rect.centerX) &&
    Number.isFinite(rect.centerY),
  )
}

function sameRow(left, right) {
  return Math.abs(left.centerY - right.centerY) <= ROW_TOLERANCE_PX
}

function nearestByHorizontalDistance(current, candidates) {
  return candidates
    .slice()
    .sort((left, right) => {
      const leftDistance = Math.abs(left.centerX - current.centerX)
      const rightDistance = Math.abs(right.centerX - current.centerX)

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance
      }

      return left.index - right.index
    })[0]
}

function nearestVerticalRow(current, rects, direction) {
  const candidates = rects.filter(rect => {
    if (rect.index === current.index) {
      return false
    }

    return direction === 'down'
      ? rect.centerY > current.centerY + ROW_TOLERANCE_PX
      : rect.centerY < current.centerY - ROW_TOLERANCE_PX
  })

  if (!candidates.length) {
    return []
  }

  const nearestDistance = Math.min(
    ...candidates.map(rect => Math.abs(rect.centerY - current.centerY)),
  )

  return candidates.filter(rect =>
    Math.abs(Math.abs(rect.centerY - current.centerY) - nearestDistance) <= ROW_TOLERANCE_PX,
  )
}

export function getSpatialNavigationIndex({ key, highlightedIndex, rects }) {
  if (!isArrowKey(key) || !hasConsistentRects(rects)) {
    return highlightedIndex
  }

  const current = rects[highlightedIndex]
  if (!current) {
    return highlightedIndex
  }

  if (key === 'ArrowRight') {
    const sameRowRight = rects
      .filter(rect => sameRow(current, rect) && rect.centerX > current.centerX)
      .sort((left, right) => left.centerX - right.centerX)[0]

    return sameRowRight?.index ?? Math.min(highlightedIndex + 1, rects.length - 1)
  }

  if (key === 'ArrowLeft') {
    const sameRowLeft = rects
      .filter(rect => sameRow(current, rect) && rect.centerX < current.centerX)
      .sort((left, right) => right.centerX - left.centerX)[0]

    return sameRowLeft?.index ?? Math.max(highlightedIndex - 1, 0)
  }

  if (key === 'ArrowDown') {
    const nextRow = nearestVerticalRow(current, rects, 'down')
    return nearestByHorizontalDistance(current, nextRow)?.index ?? highlightedIndex
  }

  if (key === 'ArrowUp') {
    const previousRow = nearestVerticalRow(current, rects, 'up')
    return nearestByHorizontalDistance(current, previousRow)?.index ?? highlightedIndex
  }

  return highlightedIndex
}
```

- [ ] **Step 4: DRY the arrow-key list**

In `getKeyboardNavigationResult`, replace:

```js
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
```

with:

```js
  if (isArrowKey(key)) {
```

- [ ] **Step 5: Run the targeted test**

Run:

```bash
node --test tests/preload/keyboardNavigation.test.mjs
```

Expected:

- PASS for all keyboard navigation tests.

- [ ] **Step 6: Commit the pure helper**

Run:

```bash
git add src/bookmarks/keyboardNavigation.js tests/preload/keyboardNavigation.test.mjs
git commit -m "feat: 增加书签空间键盘导航算法"
```

Expected:

- Commit succeeds.

## Task 3: Connect DOM Card Rects to App Runtime

**Files:**
- Modify: `src/bookmarks/HomeView.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Add DOM card-key markers**

In `src/bookmarks/HomeView.vue`, find the card wrapper:

```vue
          <article
            v-for="entry in section.entries"
            :key="entry.cardKey"
            class="bookmark-grid__item"
          >
```

Replace it with:

```vue
          <article
            v-for="entry in section.entries"
            :key="entry.cardKey"
            class="bookmark-grid__item"
            :data-bookmark-card-key="entry.cardKey"
          >
```

- [ ] **Step 2: Import the spatial helper**

In `src/App.vue`, replace:

```ts
import { getKeyboardNavigationResult } from './bookmarks/keyboardNavigation.js'
```

with:

```ts
import {
  getKeyboardNavigationResult,
  getSpatialNavigationIndex,
} from './bookmarks/keyboardNavigation.js'
```

- [ ] **Step 3: Add DOM rect collector**

In `src/App.vue`, place this helper near `buildSectionEntries`:

```ts
// 空间导航只需要当前可见卡片的位置快照，DOM 读取集中在这里，算法保持纯函数。
function collectVisibleCardRects() {
  if (typeof document === 'undefined') {
    return []
  }

  return visibleEntries.value.map((entry, index) => {
    const selector = `[data-bookmark-card-key="${CSS.escape(entry.cardKey)}"]`
    const element = document.querySelector<HTMLElement>(selector)
    if (!element) {
      return null
    }

    const rect = element.getBoundingClientRect()
    return {
      cardKey: entry.cardKey,
      index,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
    }
  })
}
```

- [ ] **Step 4: Harden selector escaping for uTools runtimes**

Because older embedded runtimes may not expose `CSS.escape`, add this helper above `collectVisibleCardRects`:

```ts
function escapeCardKey(cardKey: string) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(cardKey)
  }

  return cardKey.replace(/"/g, '\\"')
}
```

Then change the selector line inside `collectVisibleCardRects` to:

```ts
    const selector = `[data-bookmark-card-key="${escapeCardKey(entry.cardKey)}"]`
```

- [ ] **Step 5: Filter invalid DOM snapshots before calling the helper**

Change the final line of `collectVisibleCardRects` from:

```ts
  })
}
```

to:

```ts
  }).filter(Boolean)
}
```

This intentionally returns fewer rects when a DOM card is missing. `getSpatialNavigationIndex` already treats inconsistent rects as no movement.

- [ ] **Step 6: Use spatial navigation on move actions**

In `handleWindowKeydown` in `src/App.vue`, replace:

```ts
  if (result.action === 'move') {
    highlightedIndex.value = result.nextIndex
  } else if (result.action === 'open-current') {
```

with:

```ts
  if (result.action === 'move') {
    highlightedIndex.value = getSpatialNavigationIndex({
      key: event.key,
      highlightedIndex: highlightedIndex.value,
      rects: collectVisibleCardRects(),
    })
  } else if (result.action === 'open-current') {
```

- [ ] **Step 7: Run full automated checks**

Run:

```bash
npm test
npm run build
```

Expected:

- `npm test` passes.
- `npm run build` passes.

- [ ] **Step 8: Commit runtime wiring**

Run:

```bash
git add src/App.vue src/bookmarks/HomeView.vue
git commit -m "feat: 接入书签卡片空间键盘导航"
```

Expected:

- Commit succeeds.

## Task 4: Update Project Docs and Final Verification

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Update current capability description**

In `AGENTS.md`, replace the current line that says:

```md
  - 支持上下方向键切换高亮项、自动滚动保持当前项可见、回车打开书签、点击卡片打开书签
```

with:

```md
  - 支持上下左右方向键按可见卡片空间位置切换高亮项、自动滚动保持当前项可见、回车打开书签、点击卡片打开书签
```

- [ ] **Step 2: Update development smoke checklist**

In `AGENTS.md`, replace:

```md
12. 按上下方向键切换高亮卡片，确认当前项会自动滚动到可见区域，并且按回车能直接打开
```

with:

```md
12. 按上下左右方向键切换高亮卡片，确认左右键不会移动顶部输入框光标，当前项会自动滚动到可见区域，并且按回车能直接打开
```

- [ ] **Step 3: Update recommended smoke checklist**

In `AGENTS.md`, replace:

```md
14. 按上下方向键移动高亮项，确认当前卡片会保持可见，按回车确认书签可打开
```

with:

```md
14. 按上下左右方向键移动高亮项，确认左右键不会移动顶部输入框光标，左右可跨行移动，上下按视觉相邻行移动，当前卡片会保持可见，按回车确认书签可打开
```

- [ ] **Step 4: Run final automated checks**

Run:

```bash
npm test
npm run build
```

Expected:

- `npm test` passes.
- `npm run build` passes.

- [ ] **Step 5: Manual uTools smoke**

Run:

```bash
npm run dev
```

Then in uTools developer mode:

- Open the plugin with `书签`.
- Type a keyword that returns multiple cards.
- Press `ArrowLeft` and `ArrowRight`; expected: input cursor does not move and card highlight moves.
- Press `ArrowRight` at a row end; expected: next row first card is selected.
- Press `ArrowLeft` at a row start; expected: previous row last card is selected.
- Press `ArrowUp` and `ArrowDown`; expected: selection moves to the closest card on the visual previous or next row.
- Move between `置顶`、`最近打开`、`全部书签`; expected: navigation crosses sections.
- Press `Enter`; expected: current highlighted bookmark opens.

- [ ] **Step 6: Commit docs**

Run:

```bash
git add AGENTS.md
git commit -m "docs: 更新书签空间导航说明"
```

Expected:

- Commit succeeds.

## Self-Review Checklist

- Spec coverage:
  - Four arrow keys are intercepted in Task 1.
  - Spatial geometry helper and row behavior are implemented in Task 2.
  - DOM card markers and runtime rect collection are wired in Task 3.
  - Cross-section movement is naturally covered by collecting all `visibleEntries` cards in DOM order.
  - Docs and manual smoke are covered in Task 4.
- Completion scan:
  - No incomplete markers, vague “add tests” instruction, or undefined implementation step remains.
- Type consistency:
  - `getSpatialNavigationIndex({ key, highlightedIndex, rects })` is defined in Task 2 and used with the same signature in Task 3.
  - Rect objects consistently use `cardKey`, `index`, `left`, `right`, `top`, `bottom`, `centerX`, and `centerY`.
