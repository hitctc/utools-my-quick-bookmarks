# 首页压缩、多关键词搜索与键盘引导 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前 uTools 书签首页收紧成适合小窗口的紧凑界面，同时补上多关键词 `AND` 搜索、高亮提示、静态键盘引导和 Nothing 风格悬浮 icon 入口。

**Architecture:** 继续保持 `Vue 3 + preload + 普通 CSS` 的最小结构，不引入新的状态库或 UI 库。搜索、命中高亮和文案压缩优先收口到可测试的纯函数 helper，首页与设置页只做结构重排和已有逻辑的重新组合，选中滚动由 `HomeView.vue` 负责 DOM 收口，键盘引导通过首页底部常驻提示表达，不做全局左右键拦截。

**Tech Stack:** Vue 3 + Vite 6 + Node built-in `node:test` + uTools `setSubInput` + `utools.dbStorage`

---

## File Structure

- Create: `src/bookmarks/search.js`
  纯函数 helper，负责分词、域名/目录文本整理、命中判断和可见文本高亮分段。
- Create: `tests/preload/search.test.mjs`
  搜索 helper 的单测，继续沿用当前 `node --test tests/preload/*.test.mjs` 入口。
- Modify: `src/App.vue`
  接入搜索 token、搜索过滤逻辑和首页高亮项状态。
- Modify: `src/bookmarks/HomeView.vue`
  把首页 Hero 改成薄状态条，渲染悬浮设置按钮、底部提示条，并在高亮项变化时滚动到可见区域。
- Modify: `src/bookmarks/components/BookmarkCard.vue`
  卡片改成紧凑结构，保留标题、域名、目录路径、置顶和打开次数，删除 `READY / 可开`。
- Modify: `src/bookmarks/components/BookmarkCover.vue`
  使用搜索 helper 渲染高亮片段和 `网址命中` 轻提示，域名与目录路径都改成单行省略。
- Modify: `src/bookmarks/SettingsView.vue`
  承接原首页说明文案，并把“返回首页”改成 Nothing 风格 icon 入口。
- Modify: `src/main.css`
  收紧首页高度、卡片高度、icon 按钮和高亮样式，并清理旧选择器。

## Task 1: 建立搜索分词、高亮与命中 helper

**Files:**
- Create: `src/bookmarks/search.js`
- Test: `tests/preload/search.test.mjs`

- [ ] **Step 1: 先写失败测试，锁定多关键词 `AND`、高亮和 `网址命中` 规则**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeSearchTokens,
  getBookmarkSiteLabel,
  getBookmarkFolderLabel,
  getBookmarkSearchMeta,
  buildHighlightedSegments,
} from '../../src/bookmarks/search.js'

test('normalizeSearchTokens trims, lowercases and splits by whitespace', () => {
  assert.deepEqual(normalizeSearchTokens('  GitHub   ISSUE  '), ['github', 'issue'])
  assert.deepEqual(normalizeSearchTokens('   '), [])
})

test('getBookmarkSiteLabel falls back to raw url when URL parsing fails', () => {
  assert.equal(getBookmarkSiteLabel('https://github.com/openai/gpt'), 'github.com')
  assert.equal(getBookmarkSiteLabel('not-a-url'), 'not-a-url')
})

test('getBookmarkFolderLabel keeps a short chinese fallback for empty folders', () => {
  assert.equal(getBookmarkFolderLabel(['Work', 'AI']), 'Work / AI')
  assert.equal(getBookmarkFolderLabel([]), '未分类')
})

test('getBookmarkSearchMeta requires every token to hit the same bookmark', () => {
  const item = {
    title: 'GitHub Issues',
    url: 'https://github.com/openai/gpt/issues',
    folderPath: ['Work', 'OpenAI'],
  }

  const matched = getBookmarkSearchMeta(item, ['github', 'openai'])
  const missed = getBookmarkSearchMeta(item, ['github', 'slack'])

  assert.equal(matched.matches, true)
  assert.equal(missed.matches, false)
})

test('getBookmarkSearchMeta exposes urlOnlyMatch when hidden url text is the only visible hit source', () => {
  const item = {
    title: 'OpenAI Docs',
    url: 'https://platform.openai.com/docs/api-reference',
    folderPath: ['API'],
  }

  const result = getBookmarkSearchMeta(item, ['api-reference'])

  assert.equal(result.matches, true)
  assert.equal(result.urlOnlyMatch, true)
})

test('buildHighlightedSegments marks matching fragments in visible text', () => {
  const result = buildHighlightedSegments('GitHub Issues', ['hub', 'issue'])

  assert.deepEqual(result, [
    { text: 'Git', matched: false },
    { text: 'Hub', matched: true },
    { text: ' ', matched: false },
    { text: 'Issue', matched: true },
    { text: 's', matched: false },
  ])
})
```

- [ ] **Step 2: 运行新测试，确认 helper 还不存在而且红灯清晰**

Run: `node --test tests/preload/search.test.mjs`  
Expected: FAIL，报错 `Cannot find module '../../src/bookmarks/search.js'`。

- [ ] **Step 3: 用最小纯函数实现搜索 helper**

```js
function normalizeSearchTokens(query) {
  return String(query || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

function getBookmarkSiteLabel(url) {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.host || parsedUrl.protocol.replace(/:$/, '') || String(url || '')
  } catch {
    return String(url || '')
  }
}

function getBookmarkFolderLabel(folderPath) {
  return Array.isArray(folderPath) && folderPath.length ? folderPath.join(' / ') : '未分类'
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildHighlightedSegments(text, tokens) {
  const source = String(text || '')
  const normalized = Array.isArray(tokens) ? tokens.filter(Boolean) : []
  if (!source || !normalized.length) {
    return [{ text: source, matched: false }]
  }

  const pattern = normalized
    .slice()
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join('|')
  const matcher = new RegExp(`(${pattern})`, 'ig')
  return source.split(matcher).filter(Boolean).map(part => ({
    text: part,
    matched: normalized.some(token => part.toLowerCase() === token.toLowerCase()),
  }))
}

function getBookmarkSearchMeta(item, tokens) {
  const title = String(item?.title || '未命名书签')
  const site = getBookmarkSiteLabel(item?.url || '')
  const folder = getBookmarkFolderLabel(item?.folderPath || [])
  const url = String(item?.url || '')
  const normalizedTokens = normalizeSearchTokens(tokens.join(' '))

  if (!normalizedTokens.length) {
    return {
      matches: true,
      urlOnlyMatch: false,
      siteLabel: site,
      folderLabel: folder,
      titleSegments: [{ text: title, matched: false }],
      siteSegments: [{ text: site, matched: false }],
      folderSegments: [{ text: folder, matched: false }],
    }
  }

  const titleLower = title.toLowerCase()
  const siteLower = site.toLowerCase()
  const folderLower = folder.toLowerCase()
  const urlLower = url.toLowerCase()

  const matches = normalizedTokens.every(token =>
    [titleLower, siteLower, folderLower, urlLower].some(value => value.includes(token)),
  )

  const urlOnlyMatch = normalizedTokens.some(token =>
    urlLower.includes(token)
    && !titleLower.includes(token)
    && !siteLower.includes(token)
    && !folderLower.includes(token),
  )

  return {
    matches,
    urlOnlyMatch,
    siteLabel: site,
    folderLabel: folder,
    titleSegments: buildHighlightedSegments(title, normalizedTokens),
    siteSegments: buildHighlightedSegments(site, normalizedTokens),
    folderSegments: buildHighlightedSegments(folder, normalizedTokens),
  }
}

export {
  normalizeSearchTokens,
  getBookmarkSiteLabel,
  getBookmarkFolderLabel,
  buildHighlightedSegments,
  getBookmarkSearchMeta,
}
```

- [ ] **Step 4: 跑回归测试，确认 helper 稳定**

Run: `npm test`  
Expected: PASS，原有 `chromeBookmarks`、`localState`、`theme` 测试继续通过，并新增 `search.test.mjs` 通过。

- [ ] **Step 5: Commit**

```bash
git add src/bookmarks/search.js tests/preload/search.test.mjs
git commit -m "feat: 增加书签搜索高亮 helper"
```

## Task 2: 接入搜索 token 与过滤逻辑

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: 先写一个小的测试补丁，锁定 helper 在实际筛选中的 `AND` 语义**

```js
test('getBookmarkSearchMeta keeps AND semantics across title, folder and url', () => {
  const item = {
    title: 'OpenAI Docs',
    url: 'https://platform.openai.com/docs/api-reference',
    folderPath: ['Work', 'API'],
  }

  assert.equal(getBookmarkSearchMeta(item, ['openai', 'api']).matches, true)
  assert.equal(getBookmarkSearchMeta(item, ['openai', 'missing']).matches, false)
})
```

- [ ] **Step 2: 跑相关测试，确认新增断言先保护住筛选语义**

Run: `node --test tests/preload/search.test.mjs`  
Expected: PASS，说明后续只改 `App.vue` 时不会动摇 helper 契约。

- [ ] **Step 3: 在 `App.vue` 中接入搜索 token 和筛选逻辑，保持现有上下键选择**

```ts
import { computed, onMounted, ref, watch } from 'vue'
import { getBookmarkSearchMeta, normalizeSearchTokens } from './bookmarks/search.js'

const searchTokens = computed(() => normalizeSearchTokens(searchQuery.value))

const searchableItems = computed(() => {
  const tokens = searchTokens.value
  if (!tokens.length) {
    return mergedItems.value
  }

  return mergedItems.value.filter(item => getBookmarkSearchMeta(item, tokens).matches)
})

function handleWindowKeydown(event: KeyboardEvent) {
  if (currentView.value !== 'home' || loading.value || homeError.value) {
    return
  }
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return
  }

  const entries = visibleEntries.value
  if (!entries.length) {
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    window.utools?.subInputBlur?.()
    highlightedIndex.value = Math.min(highlightedIndex.value + 1, entries.length - 1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    window.utools?.subInputBlur?.()
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    const current = entries[highlightedIndex.value]
    if (current) {
      handleOpenBookmark(current.item)
    }
    return
  }

  if (event.key === 'Escape') {
    window.utools?.subInputFocus?.()
  }
}
```

- [ ] **Step 4: 只把搜索 query 和搜索态传给首页，搜索 token 在首页本地归一化用于高亮**

```vue
<HomeView
  v-if="currentView === 'home'"
  :bootstrapped="bootstrapped"
  :loading="loading"
  :error="homeError"
  :sections="visibleSections"
  :highlighted-card-key="highlightedCardKey"
  :is-search-mode="Boolean(searchTokens.length)"
  :search-query="searchQuery"
  :empty-text="emptyText"
  :show-open-count="uiSettings.showOpenCount"
  :theme-status="themeStatus"
  :total="total"
  @open-bookmark="handleOpenBookmark"
  @toggle-pin="handleTogglePin"
  @open-settings="currentView = 'settings'"
/>
```

- [ ] **Step 5: 运行测试与构建，确认逻辑层没有引入回归**

Run: `npm test && npm run build`  
Expected: 所有测试通过，Vite 构建成功，无搜索态或首页 props 的未定义报错。

- [ ] **Step 6: Commit**

```bash
git add src/App.vue
git commit -m "feat: 接入多关键词书签搜索"
```

## Task 3: 重排首页与设置页结构，压缩卡片内容

**Files:**
- Modify: `src/bookmarks/HomeView.vue`
- Modify: `src/bookmarks/SettingsView.vue`
- Modify: `src/bookmarks/components/BookmarkCard.vue`
- Modify: `src/bookmarks/components/BookmarkCover.vue`
- Modify: `src/bookmarks/types.ts`

- [ ] **Step 1: 先补首页组件的 DOM 钩子，让高亮卡片始终滚到可见区域**

```vue
<script lang="ts" setup>
import { nextTick, watch } from 'vue'

import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { normalizeSearchTokens } from './search'

const props = defineProps({
  // 现有 props 省略
  searchQuery: {
    type: String,
    default: '',
  },
})

const homeContentRef = ref(null)
const searchTokens = computed(() => normalizeSearchTokens(props.searchQuery))
const sectionsSignature = computed(() =>
  props.sections.map(section => `${section.key}:${section.entries.map(entry => entry.cardKey).join(',')}`).join('|'),
)

watch(
  [() => props.highlightedCardKey, sectionsSignature],
  async ([cardKey]) => {
    if (!cardKey) {
      return
    }

    await nextTick()
    const target = Array.from(
      homeContentRef.value?.querySelectorAll('[data-card-key]') ?? [],
    ).find(node => node.dataset.cardKey === cardKey)
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  },
)

onMounted(() => {
  if (props.highlightedCardKey) {
    void nextTick(() => {
      const target = Array.from(
        homeContentRef.value?.querySelectorAll('[data-card-key]') ?? [],
      ).find(node => node.dataset.cardKey === props.highlightedCardKey)
      target?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
  }
})
</script>
```

- [ ] **Step 2: 把首页 Hero 改成薄状态条，设置按钮改成悬浮 icon**

```vue
<template>
  <section class="page-shell page-shell--home">
    <button
      class="floating-icon-button"
      type="button"
      title="设置"
      aria-label="设置"
      @click="emit('open-settings')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5v3M12 17.5v3M4.9 7.1l2.1 2.1M17 17.7l2.1 2.1M3.5 12h3M17.5 12h3M4.9 16.9l2.1-2.1M17 6.3l2.1-2.1M12 15.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7Z" />
      </svg>
    </button>

    <header class="compact-status-bar">
      <p class="mono-label">快捷书签</p>
      <div class="compact-status-bar__metrics">
        <span class="status-chip">书签 {{ total }}</span>
        <span class="status-chip">主题 {{ themeStatus }}</span>
        <span class="status-chip status-chip--muted">{{ isSearchMode ? '搜索中' : '待搜索' }}</span>
      </div>
    </header>

    <template v-else>
      <BookmarksSection
        v-for="section in (props.sections as BookmarkSection[])"
        :key="section.key"
        :title="section.title"
        :count="section.entries.length"
      >
        <div class="bookmark-grid">
          <article
            v-for="entry in section.entries"
            :key="entry.cardKey"
            class="bookmark-grid__item"
            :data-card-key="entry.cardKey"
          >
            <BookmarkCard
              :item="entry.item"
              :show-open-count="props.showOpenCount"
              :active="entry.cardKey === props.highlightedCardKey"
              :search-tokens="searchTokens"
              @open="emit('open-bookmark', $event)"
              @toggle-pin="emit('toggle-pin', $event)"
            />
          </article>
        </div>
      </BookmarksSection>
    </template>

    <section
      v-if="bootstrapped && !loading && !error"
      class="state-strip"
    >
      <p class="state-strip__label">[ 操作提示 ]</p>
      <p class="state-strip__copy">
        上下键选择，回车打开；多个关键词用空格分开
      </p>
    </section>
  </section>
</template>
```

- [ ] **Step 3: 让卡片只显示标题、域名、目录路径、置顶与打开次数，并删除 `READY`**

```vue
<script lang="ts" setup>
import { computed } from 'vue'
import { getBookmarkSearchMeta } from '../search.js'

const props = withDefaults(
  defineProps<{
    item: BookmarkCardItem
    active?: boolean
    showOpenCount?: boolean
    searchTokens?: string[]
  }>(),
  {
    active: false,
    showOpenCount: true,
    searchTokens: () => [],
  },
)

const searchMeta = computed(() => getBookmarkSearchMeta(props.item, props.searchTokens))
</script>

<template>
  <article class="bookmark-card" :class="{ 'bookmark-card--active': active }">
    <button
      type="button"
      class="bookmark-card__pin"
      :class="{ 'bookmark-card__pin--active': item.isPinned }"
      :title="item.isPinned ? '取消置顶' : '置顶'"
      :aria-label="item.isPinned ? '取消置顶' : '置顶'"
      @keydown.enter.stop
      @click="handleTogglePin"
    >
      <span class="bookmark-card__pin-text">{{ item.isPinned ? '已置顶' : '置顶' }}</span>
    </button>

    <button type="button" class="bookmark-card__open" @keydown.enter.stop @click="handleOpen">
      <BookmarkCover
        :title="item.title"
        :open-count="item.openCount"
        :show-open-count="showOpenCount"
        :is-pinned="item.isPinned"
        :active="active"
        :search-meta="searchMeta"
      />
    </button>
  </article>
</template>
```

- [ ] **Step 4: 在 `BookmarkCover.vue` 中使用高亮片段和 `网址命中` 轻提示**

```vue
<script lang="ts" setup>
import type { PropType } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  openCount: { type: Number, required: true },
  showOpenCount: { type: Boolean, required: true },
  isPinned: { type: Boolean, required: true },
  active: { type: Boolean, required: true },
  searchMeta: {
    type: Object as PropType<{
      siteLabel: string
      folderLabel: string
      urlOnlyMatch: boolean
      titleSegments: { text: string; matched: boolean }[]
      siteSegments: { text: string; matched: boolean }[]
      folderSegments: { text: string; matched: boolean }[]
    }>,
    required: true,
  },
})
</script>

<template>
  <div class="bookmark-cover" :class="{ 'bookmark-cover--active': active }">
    <div class="bookmark-cover__row">
      <h3 class="bookmark-cover__title" :title="title">
        <span
          v-for="(segment, index) in searchMeta.titleSegments"
          :key="`title-${index}`"
          :class="{ 'search-highlight': segment.matched }"
        >
          {{ segment.text }}
        </span>
      </h3>
    </div>

    <p class="bookmark-cover__site" :title="searchMeta.siteLabel">
      <span
        v-for="(segment, index) in searchMeta.siteSegments"
        :key="`site-${index}`"
        :class="{ 'search-highlight': segment.matched }"
      >
        {{ segment.text }}
      </span>
    </p>

    <p class="bookmark-cover__folder" :title="searchMeta.folderLabel">
      <span
        v-for="(segment, index) in searchMeta.folderSegments"
        :key="`folder-${index}`"
        :class="{ 'search-highlight': segment.matched }"
      >
        {{ segment.text }}
      </span>
    </p>

    <div class="bookmark-cover__footer">
      <span v-if="showOpenCount && openCount > 0" class="bookmark-cover__chip">打开 {{ openCount }}</span>
      <span v-if="searchMeta.urlOnlyMatch" class="bookmark-cover__chip">网址命中</span>
    </div>
  </div>
</template>
```

- [ ] **Step 5: 把原首页说明迁到设置页，并改成返回 icon 按钮**

```vue
<template>
  <section class="page-shell">
    <header class="settings-header">
      <button class="inline-icon-button" type="button" title="返回首页" aria-label="返回首页" @click="emit('back')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5l-7 7l7 7M8 12h11" />
        </svg>
      </button>
      <p class="section-label">设置</p>
    </header>

    <section class="settings-card">
      <h1>Chrome 书签文件设置</h1>
      <p class="settings-copy">当前默认值只适配 macOS 下的 Google Chrome 默认 profile。</p>

      <section class="settings-note-block">
        <p class="mono-label">使用说明</p>
        <ul class="settings-note-list">
          <li>在 uTools 顶部输入多个关键词，按空格分开。</li>
          <li>用上下键切换书签，回车直接打开。</li>
          <li>首页只保留紧凑结果，详细说明统一放在设置页查看。</li>
        </ul>
      </section>

      <!-- 其余现有设置表单继续保留 -->
    </section>
  </section>
</template>
```

- [ ] **Step 6: 运行测试和构建，确认界面重排没有打断现有逻辑**

Run: `npm test && npm run build`  
Expected: 通过，构建产物中首页与设置页都不再引用已删除的 `READY` / 大 Hero 结构 class。

- [ ] **Step 7: Commit**

```bash
git add src/bookmarks/HomeView.vue src/bookmarks/SettingsView.vue src/bookmarks/components/BookmarkCard.vue src/bookmarks/components/BookmarkCover.vue src/bookmarks/search.js
git commit -m "feat: 压缩首页卡片并迁移说明信息"
```

## Task 4: 收紧样式、清理旧选择器并完成验证

**Files:**
- Modify: `src/main.css`

- [ ] **Step 1: 用一组紧凑样式替换当前高占位 Hero 和大卡片，并清理已废弃选择器**

```css
.page-shell--home {
  position: relative;
  display: grid;
  gap: 12px;
  padding: 14px;
}

.floating-icon-button {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 4;
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-visible);
  border-radius: 999px;
  background: var(--surface-raised);
}

.floating-icon-button svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.inline-icon-button {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-visible);
  border-radius: 999px;
  background: var(--surface-raised);
}

.inline-icon-button svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.compact-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 52px;
  padding: 10px 56px 10px 14px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
}

.bookmark-grid {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.bookmark-cover {
  display: grid;
  gap: 6px;
  min-height: 112px;
  padding: 12px 12px 10px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
}

.bookmark-cover__title,
.bookmark-cover__site,
.bookmark-cover__folder {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.bookmark-cover__title {
  font-size: 16px;
  line-height: 1.3;
}

.bookmark-cover__site,
.bookmark-cover__folder {
  font-size: 12px;
  line-height: 1.4;
}

.bookmark-cover__footer {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 4px;
}

.bookmark-card__pin {
  top: 8px;
  right: 8px;
  min-height: 28px;
  padding: 0 8px;
}

.search-highlight {
  color: var(--text-display);
  background: var(--accent-soft);
}

.state-strip {
  min-height: 44px;
  padding: 10px 12px;
}
```

- [ ] **Step 2: 完整跑自动验证**

Run: `npm test && npm run build`  
Expected: 全通过，`dist/` 正常生成，且首页样式类名不再依赖已经删除的大 Hero 结构。

- [ ] **Step 4: 做手动 smoke，重点看 10 个场景**

Run:

```bash
npm run dev
```

Expected:

- 首页首屏明显更矮
- 设置按钮悬浮在右上角，不挤占高度
- 书签卡片一屏数量明显增加
- 域名单行省略，目录路径单行省略
- 多关键词输入如 `github issue` 只显示全部命中的卡片
- 命中词在标题 / 域名 / 目录路径里高亮
- 仅命中隐藏 URL 时显示 `网址命中`
- 上下键切换时当前卡片保持可见
- 首页底部能持续看到简短操作提示
- 设置页承接了原首页说明内容

- [ ] **Step 4: Commit**

```bash
git add src/main.css
git commit -m "feat: 收紧首页样式与卡片密度"
```
