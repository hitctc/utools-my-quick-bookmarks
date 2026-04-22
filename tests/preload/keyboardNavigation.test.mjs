import test from 'node:test'
import assert from 'node:assert/strict'

import { getKeyboardNavigationResult, getSpatialNavigationIndex } from '../../src/bookmarks/keyboardNavigation.js'

test('all arrow keys are captured for card navigation and prevent sub input cursor movement', () => {
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
      shiftKey: false,
    })

    assert.equal(result.action, 'move')
    assert.equal(result.nextIndex, 2)
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
    shiftKey: false,
  }

  const cases = [
    { ...base, currentView: 'settings' },
    { ...base, loading: true },
    { ...base, hasError: true },
    { ...base, entryCount: 0 },
    { ...base, metaKey: true },
    { ...base, ctrlKey: true },
    { ...base, altKey: true },
    { ...base, shiftKey: true },
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

test('Enter opens current entry and Escape focuses search input', () => {
  const openResult = getKeyboardNavigationResult({
    key: 'Enter',
    currentView: 'home',
    loading: false,
    hasError: false,
    highlightedIndex: 2,
    entryCount: 5,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
  })

  assert.deepEqual(openResult, {
    action: 'open-current',
    nextIndex: 2,
    preventDefault: true,
    subInputBehavior: 'none',
  })

  const focusResult = getKeyboardNavigationResult({
    key: 'Escape',
    currentView: 'home',
    loading: false,
    hasError: false,
    highlightedIndex: 2,
    entryCount: 5,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
  })

  assert.deepEqual(focusResult, {
    action: 'focus-search',
    nextIndex: 2,
    preventDefault: false,
    subInputBehavior: 'focus',
  })
})

function createRect(index, centerX, centerY, top, left, width = 100, height = 40) {
  return {
    index,
    left,
    right: left + width,
    top,
    bottom: top + height,
    centerX,
    centerY,
  }
}

test('same row left/right move to nearest card', () => {
  const rects = [
    createRect(0, 50, 50, 20, 0),
    createRect(1, 150, 50, 20, 120),
    createRect(2, 250, 145, 120, 220),
    createRect(3, 350, 145, 120, 320),
  ]

  assert.equal(
    getSpatialNavigationIndex({ key: 'ArrowRight', highlightedIndex: 0, rects }),
    1,
  )
  assert.equal(
    getSpatialNavigationIndex({ key: 'ArrowLeft', highlightedIndex: 1, rects }),
    0,
  )
})

test('ArrowLeft selects the nearest left card when multiple candidates exist in the same row', () => {
  const rects = [
    createRect(0, 40, 50, 20, 0),
    createRect(1, 150, 50, 20, 120),
    createRect(2, 220, 50, 20, 200),
    createRect(3, 300, 145, 120, 280),
  ]

  assert.equal(
    getSpatialNavigationIndex({ key: 'ArrowLeft', highlightedIndex: 2, rects }),
    1,
  )
})

test('same row ends fall back to adjacent list item', () => {
  const rects = [
    createRect(0, 50, 50, 20, 0),
    createRect(1, 150, 50, 20, 120),
    createRect(2, 70, 145, 120, 20),
    createRect(3, 180, 145, 120, 150),
  ]

  assert.equal(
    getSpatialNavigationIndex({ key: 'ArrowRight', highlightedIndex: 1, rects }),
    2,
  )
  assert.equal(
    getSpatialNavigationIndex({ key: 'ArrowLeft', highlightedIndex: 2, rects }),
    1,
  )
})

test('row boundaries keep highlight unchanged at extremes', () => {
  const rects = [
    createRect(0, 50, 50, 20, 0),
    createRect(1, 150, 50, 20, 120),
    createRect(2, 250, 145, 120, 220),
  ]

  assert.equal(
    getSpatialNavigationIndex({ key: 'ArrowLeft', highlightedIndex: 0, rects }),
    0,
  )
  assert.equal(
    getSpatialNavigationIndex({ key: 'ArrowRight', highlightedIndex: 2, rects }),
    2,
  )
})

test('up and down choose nearest card in adjacent visual row by x distance', () => {
  const rects = [
    createRect(0, 40, 50, 10, 0),
    createRect(1, 160, 52, 8, 120),
    createRect(2, 180, 170, 150, 140),
    createRect(3, 290, 172, 150, 250),
  ]

  assert.equal(
    getSpatialNavigationIndex({ key: 'ArrowDown', highlightedIndex: 1, rects }),
    2,
  )
  assert.equal(
    getSpatialNavigationIndex({ key: 'ArrowUp', highlightedIndex: 2, rects }),
    1,
  )
})

test('top row cannot move up and bottom row cannot move down', () => {
  const rects = [
    createRect(0, 40, 50, 10, 0),
    createRect(1, 160, 50, 10, 120),
    createRect(2, 180, 170, 150, 140),
    createRect(3, 290, 170, 150, 250),
  ]

  assert.equal(
    getSpatialNavigationIndex({ key: 'ArrowUp', highlightedIndex: 0, rects }),
    0,
  )
  assert.equal(
    getSpatialNavigationIndex({ key: 'ArrowDown', highlightedIndex: 3, rects }),
    3,
  )
})

test('invalid rect list keeps highlighted index', () => {
  const mismatchIndex = [
    createRect(0, 40, 50, 10, 0),
    { ...createRect(1, 150, 52, 8, 120), index: 3 },
  ]
  assert.equal(
    getSpatialNavigationIndex({ key: 'ArrowRight', highlightedIndex: 0, rects: mismatchIndex }),
    0,
  )

  const invalidNumber = [
    createRect(0, 40, 50, 10, 0),
    { ...createRect(1, 150, Infinity, 8, 120), index: 1 },
  ]
  assert.equal(
    getSpatialNavigationIndex({ key: 'ArrowDown', highlightedIndex: 0, rects: invalidNumber }),
    0,
  )
})

test('non-integer highlighted index returns unchanged', () => {
  const rects = [
    createRect(0, 40, 50, 20, 0),
    createRect(1, 140, 50, 20, 120),
    createRect(2, 230, 145, 120, 220),
  ]

  assert.equal(
    getSpatialNavigationIndex({ key: 'ArrowDown', highlightedIndex: 1.5, rects }),
    1.5,
  )
  assert.equal(
    getSpatialNavigationIndex({ key: 'ArrowLeft', highlightedIndex: -1.2, rects }),
    -1.2,
  )
  assert.equal(
    getSpatialNavigationIndex({ key: 'ArrowRight', highlightedIndex: 2.9, rects }),
    2.9,
  )
})
