import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldReuseBookmarks } from '../../src/bookmarks/startup.js'

test('only reuses in-memory bookmarks on re-entry with the same path', () => {
  const state = { bootstrapped: true, previousPath: '/bookmarks', currentPath: '/bookmarks', itemCount: 10 }
  assert.equal(shouldReuseBookmarks(state), true)
  assert.equal(shouldReuseBookmarks({ ...state, bootstrapped: false }), false)
  assert.equal(shouldReuseBookmarks({ ...state, currentPath: '/other' }), false)
  assert.equal(shouldReuseBookmarks({ ...state, itemCount: 0 }), false)
})
