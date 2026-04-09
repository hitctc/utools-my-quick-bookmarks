# 书签标题拼音搜索 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 uTools 顶部搜索在保持现有多关键词 `AND` 规则不变的前提下，只对“书签标题”增加全拼与拼音首字母搜索能力。

**Architecture:** 继续把搜索能力收口在 `src/bookmarks/search.js`，由该模块为标题生成“原文 + 全拼 + 首字母”三类匹配入口，并用标题字符串做轻量缓存避免重复转拼音。前端视图层不感知拼音实现细节，只继续消费 `getBookmarkSearchMeta` 的匹配结果和现有高亮片段；顶部输入提示文案与协作文档在最后一任务统一同步。

**Tech Stack:** Vue 3 + Vite 6 + Node built-in `node:test` + `pinyin-pro` + uTools `setSubInput`

---

## File Structure

- Modify: `package.json`
  新增 `pinyin-pro` 依赖。
- Modify: `package-lock.json`
  锁定新增依赖版本，保持安装结果可复现。
- Modify: `src/bookmarks/search.js`
  增加标题拼音别名生成、缓存和匹配逻辑，保持现有原文高亮规则不变。
- Modify: `tests/preload/search.test.mjs`
  补齐标题全拼、首字母、混合 token 和“非标题字段不扩展拼音”的回归测试。
- Modify: `src/App.vue`
  更新 uTools 顶部输入提示文案，明确“标题支持全拼和拼音首字母”。
- Modify: `AGENTS.md`
  同步“当前真实能力”和 smoke test，避免后续协作者误判搜索边界。

## Task 1: 先用测试锁定标题拼音搜索边界

**Files:**
- Modify: `tests/preload/search.test.mjs`
- Test: `tests/preload/search.test.mjs`

- [ ] **Step 1: 在搜索单测里补上标题全拼、首字母和误命中边界**

```js
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
```

- [ ] **Step 2: 运行单测，确认当前实现还不支持标题拼音而且失败点正确**

Run: `node --test tests/preload/search.test.mjs`  
Expected: FAIL，新增用例里 `meta.matches` 为 `false`，说明失败点集中在搜索能力缺失，而不是测试写错。

- [ ] **Step 3: 记录最小修复目标，避免把拼音能力扩到非标题字段**

```txt
只修改 getBookmarkSearchMeta 的标题匹配逻辑：
1. 标题原文继续原样匹配
2. 只额外补标题 full pinyin 和 initials
3. 目录路径、域名、URL 继续保持原文匹配
4. 纯拼音命中不改高亮输出
```

- [ ] **Step 4: 再跑一次单测文件，确认只有新增用例持续失败**

Run: `node --test tests/preload/search.test.mjs`  
Expected: FAIL，老用例继续通过，新用例继续失败，没有引入额外回归。

- [ ] **Step 5: Commit**

```bash
git add tests/preload/search.test.mjs
git commit -m "test: 补充标题拼音搜索边界"
```

## Task 2: 用最小实现接入标题全拼与首字母匹配

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/bookmarks/search.js`
- Test: `tests/preload/search.test.mjs`

- [ ] **Step 1: 安装 `pinyin-pro`，保持依赖最小化**

Run: `npm install pinyin-pro`  
Expected: `package.json` 和 `package-lock.json` 新增 `pinyin-pro`，没有移除其他现有依赖。

- [ ] **Step 2: 在 `search.js` 里新增标题拼音别名与缓存 helper**

```js
import { pinyin } from 'pinyin-pro'

const titleSearchAliasCache = new Map()

function normalizeAliasText(value) {
  return toSafeText(value).trim().toLowerCase()
}

function getTitleSearchAliases(title) {
  const normalizedTitle = normalizeAliasText(title)

  if (!normalizedTitle) {
    return {
      normalizedTitle: '',
      titleFullPinyin: '',
      titleInitials: '',
    }
  }

  const cachedAliases = titleSearchAliasCache.get(normalizedTitle)
  if (cachedAliases) {
    return cachedAliases
  }

  const aliases = {
    normalizedTitle,
    titleFullPinyin: normalizeAliasText(pinyin(normalizedTitle, { toneType: 'none' }).replace(/\s+/g, '')),
    titleInitials: normalizeAliasText(
      pinyin(normalizedTitle, { pattern: 'first', toneType: 'none' }).replace(/\s+/g, ''),
    ),
  }

  titleSearchAliasCache.set(normalizedTitle, aliases)
  return aliases
}
```

- [ ] **Step 3: 只把标题拼音别名接进 `getBookmarkSearchMeta` 的标题命中判断**

```js
const { normalizedTitle, titleFullPinyin, titleInitials } = getTitleSearchAliases(title)

const tokenMatches = searchTokens.map(token => ({
  token,
  title:
    tokenMatchesText(token, normalizedTitle)
    || tokenMatchesText(token, titleFullPinyin)
    || tokenMatchesText(token, titleInitials),
  url: tokenMatchesText(token, url),
  folder: tokenMatchesText(token, folderLabel),
  site: tokenMatchesText(token, siteLabel),
  path: tokenMatchesText(token, pathLabel),
}))
```

- [ ] **Step 4: 保持原文高亮逻辑不变，防止纯拼音命中伪造中文高亮**

```js
return {
  matches,
  urlOnlyMatch,
  title,
  url,
  folderLabel,
  siteLabel,
  pathLabel,
  highlightedTitleSegments: getFieldSegments(title, matches && searchTokens.some(token => tokenMatchesText(token, title)), searchTokens),
  highlightedUrlSegments: getFieldSegments(url, matches, searchTokens),
  highlightedFolderSegments: getFieldSegments(folderLabel, matches, searchTokens),
  highlightedSiteSegments: getFieldSegments(siteLabel, matches, searchTokens),
  highlightedPathSegments: getFieldSegments(pathLabel, matches, searchTokens),
}
```

- [ ] **Step 5: 跑搜索单测，确认新增能力和老规则同时成立**

Run: `node --test tests/preload/search.test.mjs`  
Expected: PASS，原有搜索用例与新增拼音用例都通过。

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/bookmarks/search.js tests/preload/search.test.mjs
git commit -m "feat: 支持书签标题拼音搜索"
```

## Task 3: 同步输入提示、协作文档并做全量验证

**Files:**
- Modify: `src/App.vue`
- Modify: `AGENTS.md`
- Test: `tests/preload/search.test.mjs`

- [ ] **Step 1: 更新 uTools 顶部输入提示文案，准确表达标题拼音能力**

```ts
window.utools.setSubInput(
  ({ text }) => {
    searchQuery.value = String(text || '')
    highlightedIndex.value = 0
  },
  '搜索书签标题、网址或目录，标题支持全拼和拼音首字母',
  true,
)
```

- [ ] **Step 2: 更新 `AGENTS.md` 的当前真实能力与 smoke test**

```md
- 通过 uTools 顶部输入框按空格分词做多关键词 `AND` 搜索，并高亮标题、域名和目录路径中的命中片段
- 书签标题额外支持全拼和拼音首字母搜索

...

10. 输入多个关键词时用空格分开，确认只有“全部命中”的卡片会被保留
11. 对中文标题输入全拼或拼音首字母，确认结果可以命中
12. 输入目录路径的拼音，确认不会误命中
```

- [ ] **Step 3: 跑全量自动验证，覆盖依赖、搜索和构建结果**

Run: `npm test`  
Expected: PASS，全部 preload 测试通过。

Run: `npm run build`  
Expected: PASS，Vite 构建成功且 `dist/` 产物刷新。

- [ ] **Step 4: 做手动 smoke test，重点确认拼音搜索和输入框焦点不回退**

Run:

```bash
npm run dev
```

Expected:
- 在 uTools 里输入中文标题原文可以命中
- 输入同一标题的全拼可以命中
- 输入同一标题的首字母可以命中
- 输入目录路径的拼音不会误命中
- 用上下键选择结果时，顶部输入框仍保持可继续输入

- [ ] **Step 5: Commit**

```bash
git add src/App.vue AGENTS.md
git commit -m "docs: 同步标题拼音搜索说明"
```
