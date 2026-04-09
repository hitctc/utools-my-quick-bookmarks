import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildHighlightedSegments,
  getBookmarkFolderLabel,
  getBookmarkSearchMeta,
  getBookmarkSiteLabel,
  normalizeSearchTokens,
} from '../../src/bookmarks/search.js'

test('normalizeSearchTokens trims, splits on whitespace, and lowercases tokens', () => {
  assert.deepEqual(normalizeSearchTokens('  Foo\tBar \n BAZ  '), ['foo', 'bar', 'baz'])
})

test('getBookmarkSiteLabel returns the host for a valid URL and falls back to the original text', () => {
  assert.equal(getBookmarkSiteLabel('https://Example.com/path?q=1'), 'example.com')
  assert.equal(getBookmarkSiteLabel('not-a-valid-url'), 'not-a-valid-url')
})

test('getBookmarkFolderLabel returns 未分类 for an empty folder path', () => {
  assert.equal(getBookmarkFolderLabel([]), '未分类')
  assert.equal(getBookmarkFolderLabel(undefined), '未分类')
})

test('buildHighlightedSegments returns case-insensitive matched segments', () => {
  assert.deepEqual(buildHighlightedSegments('Alpha / Beta', ['alpha', 'BETA']), [
    { text: 'Alpha', matched: true },
    { text: ' / ', matched: false },
    { text: 'Beta', matched: true },
  ])
})

test('getBookmarkSearchMeta uses AND semantics across title, url, folder path, and domain', () => {
  const item = {
    title: 'Alpha Roadmap',
    url: 'https://docs.example.com/team/guide',
    folderPath: ['Projects', 'Planning'],
  }

  const meta = getBookmarkSearchMeta(item, normalizeSearchTokens('alpha guide example planning'))

  assert.equal(meta.matches, true)
  assert.equal(meta.urlOnlyMatch, false)
  assert.equal(meta.title, 'Alpha Roadmap')
  assert.equal(meta.folderLabel, 'Projects / Planning')
  assert.equal(meta.siteLabel, 'docs.example.com')
  assert.deepEqual(meta.highlightedTitleSegments, [
    { text: 'Alpha', matched: true },
    { text: ' Roadmap', matched: false },
  ])
})

test('getBookmarkSearchMeta marks urlOnlyMatch when only the hidden url part matches', () => {
  const item = {
    title: 'Unrelated title',
    url: 'https://docs.example.com/team/guide',
    folderPath: ['Archive'],
  }

  const meta = getBookmarkSearchMeta(item, normalizeSearchTokens('guide'))

  assert.equal(meta.matches, true)
  assert.equal(meta.urlOnlyMatch, true)
})

test('getBookmarkSearchMeta keeps urlOnlyMatch false when only the domain matches', () => {
  const item = {
    title: 'Unrelated title',
    url: 'https://docs.example.com/team/guide',
    folderPath: ['Archive'],
  }

  const meta = getBookmarkSearchMeta(item, normalizeSearchTokens('docs'))

  assert.equal(meta.matches, true)
  assert.equal(meta.urlOnlyMatch, false)
})

test('getBookmarkSearchMeta keeps urlOnlyMatch false when keywords split between visible fields and hidden url', () => {
  const item = {
    title: 'Alpha Roadmap',
    url: 'https://docs.example.com/team/guide',
    folderPath: ['Projects', 'Planning'],
  }

  const meta = getBookmarkSearchMeta(item, normalizeSearchTokens('alpha planning guide'))

  assert.equal(meta.matches, true)
  assert.equal(meta.urlOnlyMatch, false)
})

test('getBookmarkSearchMeta returns false when one keyword is missing', () => {
  const item = {
    title: 'Alpha Roadmap',
    url: 'https://docs.example.com/team/reference',
    folderPath: ['Projects', 'Planning'],
  }

  const meta = getBookmarkSearchMeta(item, normalizeSearchTokens('alpha planning guide'))

  assert.equal(meta.matches, false)
  assert.deepEqual(meta.highlightedTitleSegments, [{ text: 'Alpha Roadmap', matched: false }])
  assert.deepEqual(meta.highlightedUrlSegments, [{ text: 'https://docs.example.com/team/reference', matched: false }])
  assert.deepEqual(meta.highlightedFolderSegments, [{ text: 'Projects / Planning', matched: false }])
  assert.deepEqual(meta.highlightedSiteSegments, [{ text: 'docs.example.com', matched: false }])
})

test('getBookmarkSearchMeta keeps stable labels when visible fields are empty', () => {
  const meta = getBookmarkSearchMeta(
    {
      title: '',
      url: '',
      folderPath: [],
    },
    normalizeSearchTokens(''),
  )

  assert.equal(meta.title, '未命名书签')
  assert.equal(meta.folderLabel, '未分类')
  assert.equal(meta.siteLabel, '')
  assert.deepEqual(meta.highlightedTitleSegments, [{ text: '未命名书签', matched: false }])
  assert.deepEqual(meta.highlightedFolderSegments, [{ text: '未分类', matched: false }])
  assert.deepEqual(meta.highlightedSiteSegments, [{ text: '', matched: false }])
})
