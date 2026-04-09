import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildHighlightedSegments,
  getBookmarkFolderLabel,
  getBookmarkPathLabel,
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

test('getBookmarkPathLabel returns the chrome bookmark folder path with root label', () => {
  assert.equal(getBookmarkPathLabel(['go'], 'bookmark_bar'), '书签栏/go')
  assert.equal(getBookmarkPathLabel(['work', '工作学习平台网址'], 'bookmark_bar'), '书签栏/work/工作学习平台网址')
  assert.equal(getBookmarkPathLabel([], 'other'), '其他书签')
  assert.equal(getBookmarkPathLabel([], 'synced'), '已同步')
  assert.equal(getBookmarkPathLabel([], 'unknown'), '未分类')
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
    sourceRoot: 'bookmark_bar',
  }

  const meta = getBookmarkSearchMeta(item, normalizeSearchTokens('alpha guide example planning'))

  assert.equal(meta.matches, true)
  assert.equal(meta.urlOnlyMatch, false)
  assert.equal(meta.title, 'Alpha Roadmap')
  assert.equal(meta.folderLabel, 'Projects / Planning')
  assert.equal(meta.siteLabel, 'docs.example.com')
  assert.equal(meta.pathLabel, '书签栏/Projects/Planning')
  assert.deepEqual(meta.highlightedTitleSegments, [
    { text: 'Alpha', matched: true },
    { text: ' Roadmap', matched: false },
  ])
})

test('getBookmarkSearchMeta marks urlOnlyMatch when only the hidden url part matches', () => {
  const item = {
    title: 'Unrelated title',
    url: 'https://docs.example.com/team/guide?tab=security',
    folderPath: ['Archive'],
    sourceRoot: 'other',
  }

  const meta = getBookmarkSearchMeta(item, normalizeSearchTokens('security'))

  assert.equal(meta.matches, true)
  assert.equal(meta.urlOnlyMatch, true)
})

test('getBookmarkSearchMeta keeps urlOnlyMatch false when only the domain matches', () => {
  const item = {
    title: 'Unrelated title',
    url: 'https://docs.example.com/team/guide',
    folderPath: ['Archive'],
    sourceRoot: 'other',
  }

  const meta = getBookmarkSearchMeta(item, normalizeSearchTokens('docs'))

  assert.equal(meta.matches, true)
  assert.equal(meta.urlOnlyMatch, false)
})

test('getBookmarkSearchMeta keeps urlOnlyMatch false when keywords split between visible fields and hidden url', () => {
  const item = {
    title: 'Alpha Roadmap',
    url: 'https://docs.example.com/team/guide?tab=security',
    folderPath: ['Projects', 'Planning'],
    sourceRoot: 'bookmark_bar',
  }

  const meta = getBookmarkSearchMeta(item, normalizeSearchTokens('alpha planning security'))

  assert.equal(meta.matches, true)
  assert.equal(meta.urlOnlyMatch, false)
})

test('getBookmarkSearchMeta returns false when one keyword is missing', () => {
  const item = {
    title: 'Alpha Roadmap',
    url: 'https://docs.example.com/team/reference',
    folderPath: ['Projects', 'Planning'],
    sourceRoot: 'bookmark_bar',
  }

  const meta = getBookmarkSearchMeta(item, normalizeSearchTokens('alpha planning guide'))

  assert.equal(meta.matches, false)
  assert.deepEqual(meta.highlightedTitleSegments, [{ text: 'Alpha Roadmap', matched: false }])
  assert.deepEqual(meta.highlightedUrlSegments, [{ text: 'https://docs.example.com/team/reference', matched: false }])
  assert.deepEqual(meta.highlightedFolderSegments, [{ text: 'Projects / Planning', matched: false }])
  assert.deepEqual(meta.highlightedSiteSegments, [{ text: 'docs.example.com', matched: false }])
})

test('getBookmarkSearchMeta matches a chinese title by full pinyin', () => {
  const item = {
    title: '网络安全',
    url: 'https://example.com/security',
    folderPath: ['技术资料'],
    sourceRoot: 'bookmark_bar',
  }

  const meta = getBookmarkSearchMeta(item, normalizeSearchTokens('wangluoanquan'))

  assert.equal(meta.matches, true)
  assert.equal(meta.urlOnlyMatch, false)
  assert.deepEqual(meta.highlightedTitleSegments, [{ text: '网络安全', matched: false }])
})

test('getBookmarkSearchMeta matches a chinese title by pinyin initials', () => {
  const item = {
    title: '网络安全',
    url: 'https://example.com/security',
    folderPath: ['技术资料'],
    sourceRoot: 'bookmark_bar',
  }

  const meta = getBookmarkSearchMeta(item, normalizeSearchTokens('wlaq'))

  assert.equal(meta.matches, true)
  assert.equal(meta.urlOnlyMatch, false)
})

test('getBookmarkSearchMeta keeps AND semantics for mixed chinese and pinyin tokens', () => {
  const item = {
    title: '网络安全清单',
    url: 'https://example.com/checklist',
    folderPath: ['技术资料'],
    sourceRoot: 'bookmark_bar',
  }

  const meta = getBookmarkSearchMeta(item, normalizeSearchTokens('wangluo 清单'))

  assert.equal(meta.matches, true)
})

test('getBookmarkSearchMeta does not expand pinyin matching to folder labels', () => {
  const item = {
    title: 'Alpha Guide',
    url: 'https://example.com/guide',
    folderPath: ['工作学习'],
    sourceRoot: 'bookmark_bar',
  }

  const meta = getBookmarkSearchMeta(item, normalizeSearchTokens('gongzuoxuexi'))

  assert.equal(meta.matches, false)
})

test('getBookmarkSearchMeta keeps stable labels when visible fields are empty', () => {
  const meta = getBookmarkSearchMeta(
    {
      title: '',
      url: '',
      folderPath: [],
      sourceRoot: '',
    },
    normalizeSearchTokens(''),
  )

  assert.equal(meta.title, '未命名书签')
  assert.equal(meta.folderLabel, '未分类')
  assert.equal(meta.siteLabel, '')
  assert.equal(meta.pathLabel, '未分类')
  assert.deepEqual(meta.highlightedTitleSegments, [{ text: '未命名书签', matched: false }])
  assert.deepEqual(meta.highlightedFolderSegments, [{ text: '未分类', matched: false }])
  assert.deepEqual(meta.highlightedSiteSegments, [{ text: '', matched: false }])
  assert.deepEqual(meta.highlightedPathSegments, [{ text: '未分类', matched: false }])
})
