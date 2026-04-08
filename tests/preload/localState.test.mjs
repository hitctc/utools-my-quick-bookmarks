import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  normalizeUiSettings,
  normalizePinnedBookmarkMap,
  normalizeRecentOpenedMap,
  togglePinnedBookmark,
  recordBookmarkOpen,
  sortBookmarksByPinnedAndOrder,
  sortBookmarksByRecentOpen,
} = require('../../public/preload/localState.cjs')

test('normalizeUiSettings merges saved settings with defaults', () => {
  const result = normalizeUiSettings({ showRecentOpened: false })

  assert.deepEqual(result, {
    showRecentOpened: false,
    showOpenCount: true,
  })
})

test('normalizeUiSettings keeps both recent-opened and open-count toggles', () => {
  const result = normalizeUiSettings({
    showRecentOpened: false,
    showOpenCount: false,
  })

  assert.deepEqual(result, {
    showRecentOpened: false,
    showOpenCount: false,
  })
})

test('normalizePinnedBookmarkMap drops invalid bookmark ids and timestamps', () => {
  const result = normalizePinnedBookmarkMap({
    a: 100,
    b: 'bad',
    '': 200,
  })

  assert.deepEqual(result, { a: 100 })
})

test('normalizeRecentOpenedMap drops invalid open records', () => {
  const result = normalizeRecentOpenedMap({
    a: { bookmarkId: 'a', openedAt: 100, openCount: 2 },
    b: { bookmarkId: 'b', openedAt: 0, openCount: 1 },
    c: { bookmarkId: 'c', openedAt: 200, openCount: 0 },
  })

  assert.deepEqual(result, {
    a: { bookmarkId: 'a', openedAt: 100, openCount: 2 },
  })
})

test('togglePinnedBookmark stores and removes bookmark ids in local map', () => {
  const pinnedAt = 1710000000000
  const first = togglePinnedBookmark({}, 'bookmark-1', pinnedAt)
  const second = togglePinnedBookmark(first, 'bookmark-1', pinnedAt + 1)

  assert.deepEqual(first, { 'bookmark-1': pinnedAt })
  assert.deepEqual(second, {})
})

test('recordBookmarkOpen increments open count and updates openedAt timestamp', () => {
  const first = recordBookmarkOpen({}, 'bookmark-1', 100)
  const second = recordBookmarkOpen(first, 'bookmark-1', 200)

  assert.deepEqual(second, {
    'bookmark-1': {
      bookmarkId: 'bookmark-1',
      openedAt: 200,
      openCount: 2,
    },
  })
})

test('sortBookmarksByPinnedAndOrder puts pinned items first but keeps original order inside groups', () => {
  const items = [
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B' },
    { id: 'c', title: 'C' },
  ]
  const result = sortBookmarksByPinnedAndOrder(items, { b: 10 })

  assert.deepEqual(result.map(item => item.id), ['b', 'a', 'c'])
})

test('sortBookmarksByRecentOpen sorts records by openedAt desc then openCount desc', () => {
  const items = [
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B' },
    { id: 'c', title: 'C' },
  ]
  const result = sortBookmarksByRecentOpen(items, {
    a: { bookmarkId: 'a', openedAt: 100, openCount: 1 },
    b: { bookmarkId: 'b', openedAt: 200, openCount: 1 },
    c: { bookmarkId: 'c', openedAt: 200, openCount: 3 },
  })

  assert.deepEqual(result.map(item => item.id), ['c', 'b', 'a'])
})
