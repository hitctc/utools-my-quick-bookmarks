# 书签缓存秒开与手动刷新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让书签插件在已有历史数据时秒开首页，后台静默刷新真实书签文件，并在右下角提供手动刷新入口，消除每次进入时的白屏闪烁感。

**Architecture:** 继续沿用 `preload + dbStorage + Vue 3` 的最小结构，不引入新的状态库。缓存读写收口在 `public/preload/services.js` 与 `public/preload/localState.cjs`，`src/App.vue` 负责把“首次阻塞加载”和“静默刷新”分开，`HomeView.vue` 只消费刷新状态并渲染右下角刷新按钮。

**Tech Stack:** Vue 3 + Vite 6 + uTools `dbStorage` + Node built-in `node:test`

---

## File Structure

- Modify: `public/preload/localState.cjs`
  新增书签缓存对象的归一化函数，负责清理历史脏数据。
- Modify: `public/preload/services.js`
  新增读取 / 保存 / 清理书签缓存能力，并复用现有 `loadChromeBookmarks` 结果。
- Modify: `src/App.vue`
  接入缓存优先展示、后台静默刷新、手动刷新和刷新状态区分。
- Modify: `src/bookmarks/HomeView.vue`
  在右下角浮层新增刷新按钮和轻量刷新状态文案。
- Modify: `src/main.css`
  增加刷新按钮样式、刷新中的禁用态或视觉反馈。
- Modify: `tests/preload/localState.test.mjs`
  为缓存对象归一化补单测。

## Task 1: 为书签缓存增加归一化能力

**Files:**
- Modify: `public/preload/localState.cjs`
- Test: `tests/preload/localState.test.mjs`

- [ ] **Step 1: 先为缓存结构写失败测试**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeBookmarkCache,
} from '../../public/preload/localState.cjs'

test('normalizeBookmarkCache keeps valid cached bookmark payload', () => {
  const result = normalizeBookmarkCache({
    filePath: '/tmp/Bookmarks',
    total: 2,
    cachedAt: 1710000000000,
    items: [
      {
        id: '1',
        title: 'OpenAI',
        url: 'https://openai.com',
        folderPath: ['Work'],
        sourceRoot: 'bookmark_bar',
        dateAdded: '1',
      },
    ],
  })

  assert.equal(result.filePath, '/tmp/Bookmarks')
  assert.equal(result.total, 2)
  assert.equal(result.items.length, 1)
})

test('normalizeBookmarkCache drops invalid cache payload', () => {
  const result = normalizeBookmarkCache({
    filePath: '',
    total: 'bad',
    cachedAt: 0,
    items: 'bad',
  })

  assert.deepEqual(result, null)
})
```

- [ ] **Step 2: 跑缓存相关测试，确认当前实现还不存在**

Run: `node --test tests/preload/localState.test.mjs`  
Expected: FAIL，报错 `normalizeBookmarkCache is not a function` 或相关断言失败。

- [ ] **Step 3: 在 preload 本地状态模块里补最小归一化实现**

```js
function normalizeBookmarkCache(raw) {
  const data = raw && typeof raw === 'object' ? raw : null
  if (!data) {
    return null
  }

  const filePath = String(data.filePath || '').trim()
  const total = Math.floor(Number(data.total))
  const cachedAt = Math.floor(Number(data.cachedAt))
  const items = Array.isArray(data.items) ? data.items : []

  if (!filePath || !Number.isFinite(total) || total <= 0 || !Number.isFinite(cachedAt) || cachedAt <= 0) {
    return null
  }

  const normalizedItems = items
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      id: String(item.id || '').trim(),
      title: String(item.title || '').trim(),
      url: String(item.url || '').trim(),
      folderPath: Array.isArray(item.folderPath) ? item.folderPath.map(segment => String(segment || '').trim()).filter(Boolean) : [],
      sourceRoot: ['bookmark_bar', 'other', 'synced'].includes(String(item.sourceRoot)) ? item.sourceRoot : 'bookmark_bar',
      dateAdded: String(item.dateAdded || ''),
    }))
    .filter(item => item.id && item.url)

  if (!normalizedItems.length) {
    return null
  }

  return {
    filePath,
    total,
    cachedAt,
    items: normalizedItems,
  }
}

module.exports = {
  // existing exports...
  normalizeBookmarkCache,
}
```

- [ ] **Step 4: 跑单测确认缓存归一化通过**

Run: `node --test tests/preload/localState.test.mjs`  
Expected: PASS，新增缓存测试通过，原有本地状态测试保持通过。

- [ ] **Step 5: Commit**

```bash
git add public/preload/localState.cjs tests/preload/localState.test.mjs
git commit -m "feat: 增加书签缓存归一化能力"
```

## Task 2: 暴露书签缓存读写接口

**Files:**
- Modify: `public/preload/services.js`

- [ ] **Step 1: 新增缓存存储 key 和读写方法**

```js
const BOOKMARK_CACHE_KEY = 'quick-bookmarks-cache'

function getBookmarkCache() {
  const saved = window.utools.dbStorage.getItem(BOOKMARK_CACHE_KEY)
  return normalizeBookmarkCache(saved)
}

function saveBookmarkCache(result) {
  const payload = normalizeBookmarkCache({
    filePath: result?.filePath,
    total: result?.total,
    items: result?.items,
    cachedAt: Date.now(),
  })

  if (!payload) {
    return null
  }

  window.utools.dbStorage.setItem(BOOKMARK_CACHE_KEY, payload)
  return payload
}

function clearBookmarkCache() {
  window.utools.dbStorage.removeItem(BOOKMARK_CACHE_KEY)
}
```

- [ ] **Step 2: 在真实读取成功后统一回写缓存**

```js
function loadChromeBookmarks(bookmarkPath) {
  const filePath = getEffectiveChromeBookmarksPath(os.homedir(), bookmarkPath)
  // existing file read and parse...

  const result = {
    filePath,
    total: parsed.total,
    items: parsed.items,
  }

  saveBookmarkCache(result)
  return result
}
```

- [ ] **Step 3: 把缓存接口挂到 `window.services`**

```js
window.services = {
  // existing services...
  getBookmarkCache,
  saveBookmarkCache,
  clearBookmarkCache,
}
```

- [ ] **Step 4: 快速做一次本地 smoke 验证**

Run: `npm run build`  
Expected: PASS，preload 打包通过，没有 `window.services` 类型或构建报错。

- [ ] **Step 5: Commit**

```bash
git add public/preload/services.js
git commit -m "feat: 暴露书签缓存读写接口"
```

## Task 3: 首页改成缓存秒开并静默刷新

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: 新增区分阻塞加载和静默刷新所需状态**

```ts
const blockingLoading = ref(false)
const refreshing = ref(false)
const refreshError = ref('')

function hasRenderableCache() {
  return items.value.length > 0
}
```

- [ ] **Step 2: 抽出统一的结果签名，避免无变化时重复刷新页面**

```ts
function getBookmarkResultSignature(result: BookmarkLoadResult | null | undefined) {
  if (!result) {
    return ''
  }

  return JSON.stringify({
    filePath: result.filePath,
    total: result.total,
    items: result.items,
  })
}
```

- [ ] **Step 3: 增加缓存优先初始化逻辑**

```ts
function hydrateFromCache() {
  const cached = window.services.getBookmarkCache() as (BookmarkLoadResult & { cachedAt?: number }) | null

  if (!cached) {
    return false
  }

  applyBookmarkLoadResult(cached)
  return true
}

function initializeApp() {
  currentView.value = 'home'
  homeError.value = ''
  settingsError.value = ''
  refreshError.value = ''
  searchQuery.value = ''
  highlightedIndex.value = 0

  if (!window.utools || !window.services) {
    homeError.value = '请通过 uTools 接入开发模式打开当前插件'
    return
  }

  syncPersistedState('home')
  const hydrated = hydrateFromCache()
  bootstrapped.value = true

  if (hydrated) {
    void refreshBookmarksInBackground()
    return
  }

  void loadBookmarks(bookmarkPath.value, 'home', { blocking: true, preserveOnError: false })
}
```

- [ ] **Step 4: 重写加载函数，支持静默刷新和保留旧内容**

```ts
function loadBookmarks(
  nextPath = bookmarkPath.value,
  targetView: 'home' | 'settings' = currentView.value,
  options: { blocking?: boolean; preserveOnError?: boolean } = {},
) {
  const errorRef = targetView === 'settings' ? settingsError : homeError
  const shouldBlock = Boolean(options.blocking)
  const preserveOnError = Boolean(options.preserveOnError)
  const previousItems = items.value
  const previousTotal = total.value

  if (shouldBlock) {
    blockingLoading.value = true
  } else {
    refreshing.value = true
    refreshError.value = ''
  }

  errorRef.value = ''

  try {
    const nextResult = validateChromeBookmarks(nextPath)
    const previousSignature = getBookmarkResultSignature({
      filePath: bookmarkPath.value,
      total: total.value,
      items: items.value,
    })
    const nextSignature = getBookmarkResultSignature(nextResult)

    if (previousSignature !== nextSignature) {
      applyBookmarkLoadResult(nextResult)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '读取书签文件失败'

    if (shouldBlock || !preserveOnError) {
      errorRef.value = message
      items.value = []
      total.value = 0
    } else {
      items.value = previousItems
      total.value = previousTotal
      refreshError.value = message
    }
  } finally {
    blockingLoading.value = false
    refreshing.value = false
  }
}
```

- [ ] **Step 5: 增加静默刷新和手动刷新入口**

```ts
function refreshBookmarksInBackground() {
  return loadBookmarks(bookmarkPath.value, 'home', {
    blocking: false,
    preserveOnError: true,
  })
}

function refreshBookmarksManually() {
  return loadBookmarks(bookmarkPath.value, 'home', {
    blocking: false,
    preserveOnError: true,
  })
}
```

- [ ] **Step 6: 把新状态和事件透传给首页**

```vue
<HomeView
  :bootstrapped="bootstrapped"
  :loading="blockingLoading"
  :refreshing="refreshing"
  :refresh-error="refreshError"
  ...
  @refresh-bookmarks="refreshBookmarksManually"
/>
```

- [ ] **Step 7: 构建验证**

Run: `npm run build`  
Expected: PASS，`App.vue` 模板和脚本编译通过。

- [ ] **Step 8: Commit**

```bash
git add src/App.vue
git commit -m "feat: 接入书签缓存秒开与静默刷新"
```

## Task 4: 首页增加刷新按钮与轻量刷新状态

**Files:**
- Modify: `src/bookmarks/HomeView.vue`
- Modify: `src/main.css`

- [ ] **Step 1: 给首页视图补刷新状态和刷新事件**

```ts
const props = defineProps({
  // existing props...
  refreshing: {
    type: Boolean,
    required: true,
  },
  refreshError: {
    type: String,
    default: '',
  },
})

const emit = defineEmits<{
  (event: 'open-settings'): void
  (event: 'refresh-bookmarks'): void
  // existing emits...
}>()
```

- [ ] **Step 2: 在右下角浮层里新增刷新按钮，并把状态条文案切到刷新态**

```vue
<div v-if="bootstrapped && !loading && !error" class="home-dock">
  <section class="state-strip">
    <div class="state-strip__chips">
      <span class="status-chip status-chip--muted">{{ themeStatus }}</span>
      <span v-if="refreshing" class="status-chip status-chip--muted">刷新中</span>
      <span v-else-if="refreshError" class="status-chip status-chip--muted">刷新失败</span>
      <span v-else-if="isSearchMode" class="status-chip status-chip--muted">搜索中</span>
      <span class="status-chip status-chip--muted">上下键选</span>
    </div>
  </section>

  <button
    type="button"
    class="icon-button floating-action-button home-dock__refresh"
    :disabled="refreshing"
    aria-label="刷新书签"
    title="刷新书签"
    @click="emit('refresh-bookmarks')"
  >
    <svg class="icon-button__svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 11a8 8 0 1 0 2 5.5" />
      <path d="M20 4v7h-7" />
    </svg>
  </button>

  <button
    type="button"
    class="icon-button icon-button--settings floating-action-button home-dock__settings"
    aria-label="打开设置"
    title="设置"
    @click="emit('open-settings')"
  >
    <!-- existing icon -->
  </button>
</div>
```

- [ ] **Step 3: 增加刷新按钮样式和刷新中的禁用态**

```css
.home-dock__refresh {
  min-width: 40px;
  min-height: 40px;
  padding: 0 10px;
  border-radius: 14px;
  border-color: color-mix(in srgb, var(--text-primary) 28%, var(--border-visible));
  background: var(--surface-raised);
}

.home-dock__refresh:disabled {
  opacity: 0.6;
  cursor: default;
}
```

- [ ] **Step 4: 构建验证**

Run: `npm run build`  
Expected: PASS，首页右下角浮层能正常编译，样式不报错。

- [ ] **Step 5: Commit**

```bash
git add src/bookmarks/HomeView.vue src/main.css
git commit -m "feat: 增加首页手动刷新入口"
```

## Task 5: 回归验证与手动 smoke

**Files:**
- Modify: `AGENTS.md`（仅当运行方式或协作约定发生变化时）

- [ ] **Step 1: 跑最相关测试**

Run: `node --test tests/preload/localState.test.mjs`  
Expected: PASS，缓存归一化和现有本地状态逻辑都通过。

- [ ] **Step 2: 跑构建**

Run: `npm run build`  
Expected: PASS，生成最新 `dist/` 产物。

- [ ] **Step 3: 手动 smoke 测试缓存秒开**

Run:

```bash
npm run dev
```

Expected:
- 第一次进入插件，无缓存时显示加载态，读取成功后正常展示
- 第二次进入插件，首页直接显示上次结果，不再闪白屏
- 右下角点击刷新按钮时，页面不清空，状态条显示 `刷新中`
- 刷新失败时，当前列表保留，状态条显示 `刷新失败`

- [ ] **Step 4: 根据结果决定是否更新协作文档**

If needed, modify:

```md
AGENTS.md
```

Only if:
- 项目初始化流程发生变化
- 首页新增“缓存秒开 + 手动刷新”已成为后续协作者必须知道的默认行为

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "docs: 同步书签缓存与刷新行为"
```

## Self-Review

- 规格中的“缓存秒开”“后台静默刷新”“右下角手动刷新”“保留旧内容”都已分别映射到 Task 2、Task 3、Task 4、Task 5。
- 计划中没有使用 `TODO`、`后续再补` 之类占位语句。
- 所有函数名在前后任务里保持一致：`normalizeBookmarkCache`、`getBookmarkCache`、`saveBookmarkCache`、`refreshBookmarksInBackground`、`refreshBookmarksManually`。
