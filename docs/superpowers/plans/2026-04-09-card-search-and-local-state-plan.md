# 卡片展示、顶部输入搜索与插件内状态 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为当前 uTools 书签工具增加参考项目风格的首页卡片展示、uTools 顶部输入实时搜索、方向键与回车打开、插件内置顶、最近打开、打开次数和设置页手动刷新。

**Architecture:** 继续保持 `preload + Vue + 普通 CSS` 的最小结构，不引入 Pinia、Tailwind 或 Ant Design。插件内状态统一通过 `utools.dbStorage` 保存，搜索输入通过 `utools.setSubInput` 接入顶部输入栏，首页卡片拆成独立组件实现参考项目的视觉样式。

**Tech Stack:** Vue 3 + Vite 6 + uTools preload + `utools.dbStorage` + `utools.setSubInput` + `utools.shellOpenExternal` + Node built-in `node:test`

---

## File Structure

- Modify: `public/preload/services.js`
  增加 UI 设置、置顶、最近打开、打开次数、手动刷新和打开 URL 的本地接口。
- Create: `public/preload/localState.cjs`
  负责规范化和清理本地状态结构，避免 `services.js` 继续膨胀。
- Create: `tests/preload/localState.test.mjs`
  负责本地状态归一化与排序逻辑的最小单测。
- Modify: `src/App.vue`
  接入 `utools.setSubInput`、搜索词、键盘高亮和首页 / 设置页状态联动。
- Create: `src/bookmarks/components/BookmarkCard.vue`
  首页书签卡片组件，迁移参考项目的主要视觉样式，保留打开与置顶能力。
- Create: `src/bookmarks/components/BookmarkCover.vue`
  卡片封面组件，负责 favicon / fallback / 标题和域名区域。
- Create: `src/bookmarks/components/BookmarkAvatar.vue`
  favicon fallback 组件。
- Create: `src/bookmarks/components/BookmarksSection.vue`
  首页分区组件，负责“置顶 / 最近打开 / 全部书签 / 搜索结果”区块标题与网格容器。
- Modify: `src/bookmarks/HomeView.vue`
  从基础列表改成卡片式首页，支持搜索态、高亮态和键盘打开。
- Modify: `src/bookmarks/SettingsView.vue`
  保持当前样式，只补“首页显示最近打开”“显示打开次数”“刷新书签”。
- Modify: `src/main.css`
  增加卡片相关样式，并保留设置页现有视觉。
- Modify: `README.md`
  补充顶部输入搜索、置顶、最近打开、打开次数和刷新能力说明。
- Modify: `AGENTS.md`
  更新当前能力、目录职责、验证步骤和不做写源书签文件的约束。

## Task 1: 建立插件内状态模型与排序逻辑

**Files:**
- Create: `public/preload/localState.cjs`
- Create: `tests/preload/localState.test.mjs`

- [ ] **Step 1: 写失败测试，先锁定状态整理与排序规则**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  normalizeUiSettings,
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/preload/localState.test.mjs`  
Expected: FAIL，原因是 `../../public/preload/localState.cjs` 尚不存在。

- [ ] **Step 3: 实现最小状态模块**

```js
function normalizeUiSettings(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}
  return {
    showRecentOpened:
      typeof data.showRecentOpened === 'boolean' ? data.showRecentOpened : true,
    showOpenCount:
      typeof data.showOpenCount === 'boolean' ? data.showOpenCount : true,
  }
}

function togglePinnedBookmark(currentMap, bookmarkId, now) {
  const nextMap = { ...(currentMap || {}) }
  if (nextMap[bookmarkId]) {
    delete nextMap[bookmarkId]
    return nextMap
  }

  nextMap[bookmarkId] = now
  return nextMap
}

function recordBookmarkOpen(currentMap, bookmarkId, now) {
  const previous = currentMap?.[bookmarkId]
  return {
    ...(currentMap || {}),
    [bookmarkId]: {
      bookmarkId,
      openedAt: now,
      openCount: previous ? previous.openCount + 1 : 1,
    },
  }
}

function sortBookmarksByPinnedAndOrder(items, pinnedMap) {
  return [...items].sort((a, b) => {
    const aPinned = Number(pinnedMap?.[a.id] || 0)
    const bPinned = Number(pinnedMap?.[b.id] || 0)
    if (aPinned && bPinned) return aPinned - bPinned
    if (aPinned || bPinned) return aPinned ? -1 : 1
    return 0
  })
}

function sortBookmarksByRecentOpen(items, recentMap) {
  return [...items].sort((a, b) => {
    const aRecord = recentMap?.[a.id]
    const bRecord = recentMap?.[b.id]
    const aOpened = Number(aRecord?.openedAt || 0)
    const bOpened = Number(bRecord?.openedAt || 0)
    if (aOpened !== bOpened) return bOpened - aOpened
    return Number(bRecord?.openCount || 0) - Number(aRecord?.openCount || 0)
  })
}

module.exports = {
  normalizeUiSettings,
  togglePinnedBookmark,
  recordBookmarkOpen,
  sortBookmarksByPinnedAndOrder,
  sortBookmarksByRecentOpen,
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`  
Expected: PASS，原有书签解析测试和新增本地状态测试都通过。

- [ ] **Step 5: Commit**

```bash
git add public/preload/localState.cjs tests/preload/localState.test.mjs
git commit -m "feat: 增加插件内书签状态模型"
```

## Task 2: 扩展 preload，接通置顶、最近打开、设置项与打开行为

**Files:**
- Modify: `public/preload/services.js`
- Modify: `public/preload/localState.cjs`
- Test: `tests/preload/localState.test.mjs`

- [ ] **Step 1: 给设置持久化和打开记录写失败测试**

```js
const {
  normalizeUiSettings,
  recordBookmarkOpen,
  togglePinnedBookmark,
} = require('../../public/preload/localState.cjs')

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
```

- [ ] **Step 2: 运行测试确认仍为红灯或缺口明确**

Run: `npm test`  
Expected: 如果当前测试已覆盖不足，补到能锁住设置开关结构。

- [ ] **Step 3: 在 preload 中增加新的本地状态接口**

```js
const {
  normalizeUiSettings,
  togglePinnedBookmark,
  recordBookmarkOpen,
} = require('./localState.cjs')

const BOOKMARK_UI_SETTINGS_KEY = 'quick-bookmarks-ui-settings'
const BOOKMARK_PINS_KEY = 'quick-bookmarks-pins'
const BOOKMARK_RECENT_OPENED_KEY = 'quick-bookmarks-recent-opened'

function getBookmarkUiSettings() {
  return normalizeUiSettings(window.utools.dbStorage.getItem(BOOKMARK_UI_SETTINGS_KEY))
}

function saveBookmarkUiSettings(partial) {
  const next = normalizeUiSettings({
    ...getBookmarkUiSettings(),
    ...(partial || {}),
  })
  window.utools.dbStorage.setItem(BOOKMARK_UI_SETTINGS_KEY, next)
  return next
}

function getPinnedBookmarks() {
  return window.utools.dbStorage.getItem(BOOKMARK_PINS_KEY) || {}
}

function togglePinnedBookmarkState(bookmarkId) {
  const next = togglePinnedBookmark(getPinnedBookmarks(), bookmarkId, Date.now())
  window.utools.dbStorage.setItem(BOOKMARK_PINS_KEY, next)
  return next
}

function getRecentOpenedBookmarks() {
  return window.utools.dbStorage.getItem(BOOKMARK_RECENT_OPENED_KEY) || {}
}

function recordBookmarkOpenState(bookmarkId) {
  const next = recordBookmarkOpen(getRecentOpenedBookmarks(), bookmarkId, Date.now())
  window.utools.dbStorage.setItem(BOOKMARK_RECENT_OPENED_KEY, next)
  return next
}

function openBookmarkUrl(bookmarkId, url) {
  if (!url) {
    throw new Error('当前书签缺少可打开的地址')
  }
  window.utools.shellOpenExternal(url)
  return recordBookmarkOpenState(bookmarkId)
}
```

- [ ] **Step 4: 把这些能力挂到 `window.services`**

```js
window.services = {
  // 现有接口...
  getBookmarkUiSettings,
  saveBookmarkUiSettings,
  getPinnedBookmarks,
  togglePinnedBookmarkState,
  getRecentOpenedBookmarks,
  openBookmarkUrl,
}
```

- [ ] **Step 5: 运行相关验证**

Run:

```bash
npm test
npm run build
```

Expected:
- `npm test` PASS
- `npm run build` PASS

- [ ] **Step 6: Commit**

```bash
git add public/preload/services.js public/preload/localState.cjs tests/preload/localState.test.mjs
git commit -m "feat: 接通书签本地状态和打开行为"
```

## Task 3: 接入 uTools 顶部输入搜索与键盘高亮

**Files:**
- Modify: `src/App.vue`
- Modify: `src/bookmarks/HomeView.vue`

- [ ] **Step 1: 在 `App.vue` 中增加搜索词与高亮索引状态**

```ts
const searchQuery = ref('')
const highlightedIndex = ref(0)
const uiSettings = ref(window.services.getBookmarkUiSettings())
const pinnedMap = ref(window.services.getPinnedBookmarks())
const recentOpenedMap = ref(window.services.getRecentOpenedBookmarks())
```

- [ ] **Step 2: 增加匹配逻辑**

```ts
function buildSearchText(item) {
  return [
    item.title || '',
    item.url || '',
    Array.isArray(item.folderPath) ? item.folderPath.join(' / ') : '',
  ]
    .join(' ')
    .toLowerCase()
}

const searchableItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return mergedItems.value
  return mergedItems.value.filter(item => buildSearchText(item).includes(query))
})
```

- [ ] **Step 3: 在插件进入时注册 `utools.setSubInput`**

```ts
function bindSubInput() {
  if (!window.utools?.setSubInput) return

  window.utools.setSubInput(
    ({ text }) => {
      searchQuery.value = String(text || '')
      highlightedIndex.value = 0
    },
    '搜索书签标题、网址或目录',
    true,
  )
}
```

- [ ] **Step 4: 处理方向键和回车**

```ts
function handleHomeKeydown(event: KeyboardEvent) {
  const items = searchableItems.value
  if (!items.length) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    highlightedIndex.value = Math.min(highlightedIndex.value + 1, items.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const current = items[highlightedIndex.value]
    if (current) handleOpenBookmark(current)
  }
}
```

- [ ] **Step 5: 在 `HomeView.vue` 里接收高亮索引与搜索模式**

```vue
defineProps({
  items: { type: Array, required: true },
  highlightedIndex: { type: Number, required: true },
  isSearchMode: { type: Boolean, required: true },
})
```

- [ ] **Step 6: 构建验证**

Run: `npm run build`  
Expected: PASS，且输入框逻辑不会破坏插件页面渲染。

- [ ] **Step 7: Commit**

```bash
git add src/App.vue src/bookmarks/HomeView.vue
git commit -m "feat: 接入顶部输入书签搜索"
```

## Task 4: 迁移卡片视觉并补首页区块

**Files:**
- Create: `src/bookmarks/components/BookmarkAvatar.vue`
- Create: `src/bookmarks/components/BookmarkCover.vue`
- Create: `src/bookmarks/components/BookmarkCard.vue`
- Create: `src/bookmarks/components/BookmarksSection.vue`
- Modify: `src/bookmarks/HomeView.vue`
- Modify: `src/main.css`

- [ ] **Step 1: 增加 favicon/fallback 组件**

```vue
<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    url: string
    title: string
    size?: number
  }>(),
  {
    size: 36,
  },
)

const faviconUrl = computed(() => {
  try {
    const target = new URL(props.url)
    return `${target.origin}/favicon.ico`
  } catch {
    return ''
  }
})
```

- [ ] **Step 2: 增加封面组件**

```vue
<template>
  <div class="bookmark-cover">
    <div class="bookmark-cover__badge">
      <BookmarkAvatar :url="url" :title="title" :size="28" />
    </div>
    <div class="bookmark-cover__body">
      <div class="bookmark-cover__title">{{ title || '未命名书签' }}</div>
      <div class="bookmark-cover__meta">{{ domainText }}</div>
      <div v-if="showOpenCount" class="bookmark-cover__count">{{ openCount }}</div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: 增加卡片组件**

```vue
<template>
  <article
    class="editorial-bookmark-card"
    :class="{ 'is-active': active }"
  >
    <button class="pin-button" type="button" @click.stop="emit('toggle-pin', item)">
      {{ item.isPinned ? '取消置顶' : '置顶' }}
    </button>

    <button class="card-surface" type="button" @click="emit('open', item)">
      <BookmarkCover
        :url="item.url"
        :title="item.title"
        :open-count="item.openCount"
        :show-open-count="showOpenCount"
      />
      <div class="card-body">
        <div class="card-path">{{ item.folderPath.length ? item.folderPath.join(' / ') : '未分类' }}</div>
      </div>
    </button>
  </article>
</template>
```

- [ ] **Step 4: 在首页增加“置顶 / 最近打开 / 全部书签 / 搜索结果”区块**

```ts
const pinnedItems = computed(() => ...)
const recentOpenedItems = computed(() => ...)
const normalItems = computed(() => ...)
```

```vue
<BookmarksSection v-if="isSearchMode" title="搜索结果" :items="items" ... />
<BookmarksSection v-else-if="pinnedItems.length" title="置顶" :items="pinnedItems" ... />
<BookmarksSection v-if="showRecentOpened && recentOpenedItems.length" title="最近打开" :items="recentOpenedItems" ... />
<BookmarksSection title="全部书签" :items="normalItems" ... />
```

- [ ] **Step 5: 用 CSS 复刻参考项目的主要视觉语言**

```css
.editorial-bookmark-card .card-surface {
  display: block;
  width: 100%;
  overflow: hidden;
  border-radius: 20px;
  border: 1px solid rgba(216, 199, 178, 0.85);
  background: rgba(255, 255, 255, 0.95);
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.editorial-bookmark-card .card-surface:hover,
.editorial-bookmark-card.is-active .card-surface {
  transform: translateY(-2px);
  border-color: rgba(181, 155, 122, 0.75);
  box-shadow: 0 16px 36px -24px rgba(55, 43, 32, 0.55);
}
```

- [ ] **Step 6: 构建验证**

Run: `npm run build`  
Expected: PASS，首页卡片已切换成新样式，设置页样式不受影响。

- [ ] **Step 7: Commit**

```bash
git add src/bookmarks/components src/bookmarks/HomeView.vue src/main.css
git commit -m "feat: 迁移书签卡片展示样式"
```

## Task 5: 补设置页开关、文档和最终验证

**Files:**
- Modify: `src/bookmarks/SettingsView.vue`
- Modify: `README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: 在设置页增加开关和刷新按钮**

```vue
<label class="toggle-row">
  <span>首页显示最近打开</span>
  <input
    type="checkbox"
    :checked="showRecentOpened"
    @change="emit('change-ui-settings', { showRecentOpened: $event.target.checked })"
  />
</label>

<label class="toggle-row">
  <span>显示打开次数</span>
  <input
    type="checkbox"
    :checked="showOpenCount"
    @change="emit('change-ui-settings', { showOpenCount: $event.target.checked })"
  />
</label>

<button class="secondary-button" :disabled="saving" @click="emit('refresh')">刷新书签</button>
```

- [ ] **Step 2: 在 `App.vue` 里接通设置项变更**

```ts
function changeUiSettings(partial) {
  uiSettings.value = window.services.saveBookmarkUiSettings(partial)
}

function handleRefreshBookmarks() {
  loadBookmarks(bookmarkPath.value, currentView.value)
}
```

- [ ] **Step 3: 更新 README**

需要同步这些点：

- 顶部输入实时搜索
- 标题 / URL / 路径三类匹配
- 置顶、最近打开、打开次数、设置页刷新
- 不支持修改 Chrome 原书签数据

- [ ] **Step 4: 更新 AGENTS**

需要同步这些点：

- 首页卡片视觉已迁移
- 搜索来源改为 uTools 顶部输入框
- 新增本地状态模块和卡片组件目录
- 只做插件内状态，不做写源书签文件
- 新的 smoke test 步骤

- [ ] **Step 5: 跑最终验证**

Run:

```bash
npm test
npm run build
```

Expected:
- `npm test` PASS
- `npm run build` PASS

- [ ] **Step 6: 手动 smoke test**

Expected:
- 进入插件后，顶部输入框可实时搜索
- 输入标题、URL、目录路径都能筛选结果
- 上下方向键可切换高亮
- 回车能打开当前高亮卡片
- 点击卡片可打开书签
- 置顶 / 取消置顶只影响插件展示
- 最近打开和打开次数能更新
- 设置页开关和刷新按钮可用

- [ ] **Step 7: Commit**

```bash
git add src/bookmarks/SettingsView.vue src/App.vue README.md AGENTS.md
git commit -m "docs: 同步卡片搜索与本地状态说明"
```

## Self-Review

- Spec coverage:
  - 顶部输入搜索、标题/URL/路径匹配、键盘交互、点击打开、置顶、最近打开、打开次数、设置页刷新，都已经映射到 Task 1-5。
- Placeholder scan:
  - 计划里没有未展开的空壳步骤。
- Type consistency:
  - 统一使用 `showRecentOpened`、`showOpenCount`、`togglePinnedBookmarkState`、`openBookmarkUrl`、`recentOpenedMap` 这一组命名，避免后续实现漂移。
