# Nothing 风格主题重构与三态主题 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为当前 uTools 书签插件加入 `跟随系统 / 深色 / 浅色` 三态主题，并把首页、设置页和书签卡片整体重构为 Nothing 风格的黑白工业感界面。

**Architecture:** 继续保持 `preload + Vue + 普通 CSS` 的最小结构，不引入路由、组件库或状态库。主题设置继续并入现有 `BookmarkUiSettings`，纯逻辑通过可测试的小模块收口，视觉重构集中在 `App.vue`、`src/bookmarks/*` 和 `src/main.css`。

**Tech Stack:** Vue 3 + Vite 6 + TypeScript in SFC + plain CSS + Node built-in `node:test` + uTools `dbStorage`

---

## File Structure

- Modify: `public/preload/localState.cjs`
  扩展 UI 设置默认值和归一化逻辑，加入 `themeMode`。
- Modify: `src/bookmarks/types.ts`
  增加主题模式和有效主题的前端类型。
- Create: `src/bookmarks/theme.js`
  抽出三态主题解析和文案格式化的纯函数，避免把逻辑直接堆进 `App.vue`。
- Modify: `src/App.vue`
  管理系统主题监听、有效主题计算、根节点 `data-theme` 同步，以及首页 / 设置页的主题数据传递。
- Modify: `src/bookmarks/HomeView.vue`
  重做首页 hero、状态条和区块结构。
- Modify: `src/bookmarks/SettingsView.vue`
  增加主题模式分段控件并改为技术手册式表单布局。
- Modify: `src/bookmarks/components/BookmarksSection.vue`
  把区块标题和计数改成更克制的技术面板样式。
- Modify: `src/bookmarks/components/BookmarkCard.vue`
  重做置顶按钮结构和卡片交互壳。
- Modify: `src/bookmarks/components/BookmarkCover.vue`
  移除彩色渐变封面，改成单色信息面板。
- Modify: `src/bookmarks/components/BookmarkAvatar.vue`
  移除彩色渐变头像，改成单色设备标签式头像。
- Modify: `src/main.css`
  引入 Google Fonts，新增深浅主题 token 和 Nothing 风格组件样式，移除旧的渐变玻璃风格。
- Modify: `tests/preload/localState.test.mjs`
  给 `themeMode` 默认值、非法值回退和设置合并补测试。
- Create: `tests/preload/theme.test.mjs`
  测试三态主题解析和展示文案。
- Modify: `README.md`
  补充主题模式能力和深浅主题说明。
- Modify: `AGENTS.md`
  更新当前能力、目录职责和 smoke test，纳入主题模式和视觉重构后的界面说明。

## Task 1: 扩展 UI 设置模型，加入三态主题

**Files:**
- Modify: `public/preload/localState.cjs`
- Modify: `src/bookmarks/types.ts`
- Modify: `tests/preload/localState.test.mjs`

- [ ] **Step 1: 先给 UI 设置归一化补失败测试**

```js
test('normalizeUiSettings falls back to system theme mode by default', () => {
  const result = normalizeUiSettings({ showRecentOpened: false })

  assert.deepEqual(result, {
    showRecentOpened: false,
    showOpenCount: true,
    themeMode: 'system',
  })
})

test('normalizeUiSettings drops invalid theme mode values', () => {
  const result = normalizeUiSettings({
    showRecentOpened: true,
    showOpenCount: true,
    themeMode: 'midnight',
  })

  assert.deepEqual(result, {
    showRecentOpened: true,
    showOpenCount: true,
    themeMode: 'system',
  })
})

test('normalizeUiSettings keeps explicit dark and light theme modes', () => {
  assert.equal(normalizeUiSettings({ themeMode: 'dark' }).themeMode, 'dark')
  assert.equal(normalizeUiSettings({ themeMode: 'light' }).themeMode, 'light')
})
```

- [ ] **Step 2: 运行测试确认红灯**

Run: `npm test`  
Expected: FAIL，现有断言里缺少 `themeMode`，并且 `normalizeUiSettings` 还不会处理无效主题值。

- [ ] **Step 3: 最小实现主题模式归一化和类型**

`public/preload/localState.cjs`

```js
const THEME_MODES = new Set(['system', 'dark', 'light'])

const DEFAULT_UI_SETTINGS = {
  showRecentOpened: true,
  showOpenCount: true,
  themeMode: 'system',
}

function normalizeThemeMode(raw) {
  return THEME_MODES.has(String(raw || '')) ? String(raw) : DEFAULT_UI_SETTINGS.themeMode
}

function normalizeUiSettings(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}

  return {
    showRecentOpened:
      typeof data.showRecentOpened === 'boolean'
        ? data.showRecentOpened
        : DEFAULT_UI_SETTINGS.showRecentOpened,
    showOpenCount:
      typeof data.showOpenCount === 'boolean'
        ? data.showOpenCount
        : DEFAULT_UI_SETTINGS.showOpenCount,
    themeMode: normalizeThemeMode(data.themeMode),
  }
}

module.exports = {
  DEFAULT_UI_SETTINGS,
  normalizeThemeMode,
  normalizeUiSettings,
  normalizePinnedBookmarkMap,
  normalizeRecentOpenedMap,
  togglePinnedBookmark,
  recordBookmarkOpen,
  sortBookmarksByPinnedAndOrder,
  sortBookmarksByRecentOpen,
}
```

`src/bookmarks/types.ts`

```ts
export type BookmarkThemeMode = 'system' | 'dark' | 'light'
export type BookmarkResolvedTheme = 'dark' | 'light'

export interface BookmarkUiSettings {
  showRecentOpened: boolean
  showOpenCount: boolean
  themeMode: BookmarkThemeMode
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`  
Expected: PASS，`tests/preload/localState.test.mjs` 通过，且现有置顶 / 最近打开测试不回归。

- [ ] **Step 5: Commit**

```bash
git add public/preload/localState.cjs src/bookmarks/types.ts tests/preload/localState.test.mjs
git commit -m "feat: 增加三态主题设置模型"
```

## Task 2: 抽出主题解析逻辑并接到 App

**Files:**
- Create: `src/bookmarks/theme.js`
- Create: `tests/preload/theme.test.mjs`
- Modify: `src/App.vue`

- [ ] **Step 1: 先给主题解析纯函数写失败测试**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SYSTEM_THEME_QUERY,
  resolveThemeMode,
  formatThemeStatus,
} from '../../src/bookmarks/theme.js'

test('resolveThemeMode returns explicit dark and light values as-is', () => {
  assert.equal(resolveThemeMode('dark', false), 'dark')
  assert.equal(resolveThemeMode('light', true), 'light')
})

test('resolveThemeMode follows system preference when themeMode is system', () => {
  assert.equal(resolveThemeMode('system', true), 'dark')
  assert.equal(resolveThemeMode('system', false), 'light')
})

test('formatThemeStatus shows system mode and effective theme together', () => {
  assert.equal(formatThemeStatus('system', 'dark'), 'SYSTEM / DARK')
  assert.equal(formatThemeStatus('dark', 'dark'), 'DARK')
})

test('SYSTEM_THEME_QUERY matches prefers-color-scheme dark media query', () => {
  assert.equal(SYSTEM_THEME_QUERY, '(prefers-color-scheme: dark)')
})
```

- [ ] **Step 2: 运行测试确认缺口存在**

Run: `node --test tests/preload/theme.test.mjs`  
Expected: FAIL，`src/bookmarks/theme.js` 还不存在。

- [ ] **Step 3: 新建主题工具模块并把有效主题接到 App**

`src/bookmarks/theme.js`

```js
export const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)'

export function resolveThemeMode(themeMode, prefersDark) {
  if (themeMode === 'dark' || themeMode === 'light') {
    return themeMode
  }

  return prefersDark ? 'dark' : 'light'
}

export function formatThemeStatus(themeMode, resolvedTheme) {
  if (themeMode === 'system') {
    return `SYSTEM / ${resolvedTheme.toUpperCase()}`
  }

  return resolvedTheme.toUpperCase()
}
```

`src/App.vue`

```ts
import { resolveThemeMode, formatThemeStatus, SYSTEM_THEME_QUERY } from './bookmarks/theme.js'
import type { BookmarkResolvedTheme, BookmarkThemeMode } from './bookmarks/types'

const systemPrefersDark = ref(false)
let systemThemeMedia: MediaQueryList | null = null

const resolvedTheme = computed<BookmarkResolvedTheme>(() =>
  resolveThemeMode(uiSettings.value.themeMode, systemPrefersDark.value),
)

const themeStatus = computed(() =>
  formatThemeStatus(uiSettings.value.themeMode, resolvedTheme.value),
)

function applyTheme(theme: BookmarkResolvedTheme) {
  document.documentElement.dataset.theme = theme
}

function handleSystemThemeChange(event: MediaQueryListEvent) {
  systemPrefersDark.value = event.matches
}

onMounted(() => {
  if (window.matchMedia) {
    systemThemeMedia = window.matchMedia(SYSTEM_THEME_QUERY)
    systemPrefersDark.value = systemThemeMedia.matches

    if (systemThemeMedia.addEventListener) {
      systemThemeMedia.addEventListener('change', handleSystemThemeChange)
    } else {
      systemThemeMedia.addListener(handleSystemThemeChange)
    }
  }
})

watch(resolvedTheme, theme => {
  applyTheme(theme)
}, { immediate: true })

onBeforeUnmount(() => {
  if (!systemThemeMedia) {
    return
  }

  if (systemThemeMedia.removeEventListener) {
    systemThemeMedia.removeEventListener('change', handleSystemThemeChange)
  } else {
    systemThemeMedia.removeListener(handleSystemThemeChange)
  }
})
```

模板增加传参：

```vue
<HomeView
  :theme-mode="uiSettings.themeMode"
  :theme-status="themeStatus"
  ...
/>
<SettingsView
  :theme-mode="uiSettings.themeMode"
  ...
/>
```

- [ ] **Step 4: 跑主题测试和全量预加载测试**

Run: `npm test`  
Expected: PASS，新增 `tests/preload/theme.test.mjs` 和原有 preload 测试都通过。

- [ ] **Step 5: Commit**

```bash
git add src/bookmarks/theme.js src/App.vue tests/preload/theme.test.mjs
git commit -m "feat: 接通主题解析与系统主题监听"
```

## Task 3: 重做首页和设置页结构，加入主题设置区

**Files:**
- Modify: `src/bookmarks/HomeView.vue`
- Modify: `src/bookmarks/SettingsView.vue`
- Modify: `src/bookmarks/components/BookmarksSection.vue`

- [ ] **Step 1: 调整首页 props 和 hero / 状态条结构**

`src/bookmarks/HomeView.vue`

```vue
const props = defineProps({
  bookmarkPath: { type: String, required: true },
  bootstrapped: { type: Boolean, required: true },
  loading: { type: Boolean, required: true },
  error: { type: String, default: '' },
  sections: { type: Array, required: true },
  highlightedCardKey: { type: String, default: '' },
  isSearchMode: { type: Boolean, required: true },
  searchQuery: { type: String, default: '' },
  emptyText: { type: String, default: '' },
  showOpenCount: { type: Boolean, required: true },
  total: { type: Number, required: true },
  themeMode: { type: String, required: true },
  themeStatus: { type: String, required: true },
})
```

```vue
<header class="hero hero--nothing">
  <div class="hero__lead">
    <p class="mono-label">QUICK BOOKMARKS</p>
    <div class="hero__metric">
      <strong class="hero__number">{{ total }}</strong>
      <div class="hero__copy">
        <h1>我的快捷书签</h1>
        <p class="hero__text">使用 uTools 顶部输入框搜索、切换高亮并直接打开书签。</p>
      </div>
    </div>
  </div>

  <div class="hero__side">
    <div class="hero__status-row">
      <span class="status-chip">[ {{ themeStatus }} ]</span>
      <span class="status-chip status-chip--muted">MODE {{ themeMode.toUpperCase() }}</span>
    </div>
    <p class="hero__path-label">BOOKMARK FILE</p>
    <p class="hero__path" :title="bookmarkPath">{{ bookmarkPath || '尚未确定路径' }}</p>
    <button class="technical-button" @click="emit('open-settings')">SETTINGS</button>
  </div>
</header>
```

状态条：

```vue
<section
  v-if="bootstrapped && !loading && !error"
  class="state-strip"
  :class="{ 'state-strip--active': isSearchMode }"
>
  <p class="state-strip__label">{{ isSearchMode ? '[ FILTERING ]' : '[ SEARCH READY ]' }}</p>
  <p class="state-strip__copy">
    <template v-if="isSearchMode">
      当前搜索词：<strong>{{ searchQuery }}</strong>，按方向键切换高亮，按回车打开。
    </template>
    <template v-else>
      支持模糊匹配标题、URL 和目录路径，不在页面内额外提供搜索框。
    </template>
  </p>
</section>
```

- [ ] **Step 2: 增加设置页主题模式分段控件和技术手册式分区**

`src/bookmarks/SettingsView.vue`

```vue
const props = defineProps({
  modelValue: { type: String, required: true },
  showRecentOpened: { type: Boolean, required: true },
  showOpenCount: { type: Boolean, required: true },
  themeMode: { type: String, required: true },
  saving: { type: Boolean, required: true },
  error: { type: String, default: '' },
})

function emitThemeMode(mode: 'system' | 'dark' | 'light') {
  emit('change-ui-settings', { themeMode: mode })
}
```

```vue
<section class="settings-panel">
  <p class="mono-label">THEME MODE</p>
  <div class="segmented-control" role="tablist" aria-label="主题模式">
    <button
      type="button"
      class="segmented-control__button"
      :class="{ 'segmented-control__button--active': themeMode === 'system' }"
      @click="emitThemeMode('system')"
    >
      SYSTEM
    </button>
    <button
      type="button"
      class="segmented-control__button"
      :class="{ 'segmented-control__button--active': themeMode === 'dark' }"
      @click="emitThemeMode('dark')"
    >
      DARK
    </button>
    <button
      type="button"
      class="segmented-control__button"
      :class="{ 'segmented-control__button--active': themeMode === 'light' }"
      @click="emitThemeMode('light')"
    >
      LIGHT
    </button>
  </div>
</section>
```

错误信息改成内联状态：

```vue
<p v-if="error" class="field-error">[ ERROR: {{ error }} ]</p>
```

- [ ] **Step 3: 把区块头改成技术面板样式**

`src/bookmarks/components/BookmarksSection.vue`

```vue
<header class="bookmarks-section__header">
  <div class="bookmarks-section__meta">
    <p class="mono-label">{{ props.title }}</p>
    <p class="bookmarks-section__description">{{ props.description }}</p>
  </div>
  <span class="bookmarks-section__count">[ {{ count }} ]</span>
</header>
```

- [ ] **Step 4: 先做一轮构建验证组件接口**

Run: `npm run build`  
Expected: PASS；如果报错，优先修正 `HomeView` / `SettingsView` 新增 props 和 `App.vue` 传参不一致的问题。

- [ ] **Step 5: Commit**

```bash
git add src/bookmarks/HomeView.vue src/bookmarks/SettingsView.vue src/bookmarks/components/BookmarksSection.vue
git commit -m "feat: 重构首页与设置页主题结构"
```

## Task 4: 把书签卡片、封面和头像切到单色面板风格

**Files:**
- Modify: `src/bookmarks/components/BookmarkCard.vue`
- Modify: `src/bookmarks/components/BookmarkCover.vue`
- Modify: `src/bookmarks/components/BookmarkAvatar.vue`

- [ ] **Step 1: 调整卡片交互壳和置顶按钮**

`src/bookmarks/components/BookmarkCard.vue`

```vue
<article class="bookmark-card" :class="{ 'bookmark-card--active': active }">
  <button
    type="button"
    class="bookmark-card__pin"
    :class="{ 'bookmark-card__pin--active': item.isPinned }"
    :title="item.isPinned ? '取消置顶' : '置顶书签'"
    @click="handleTogglePin"
  >
    <span class="bookmark-card__pin-text">{{ item.isPinned ? '[ UNPIN ]' : '[ PIN ]' }}</span>
  </button>

  <button type="button" class="bookmark-card__open" @click="handleOpen">
    <BookmarkCover
      :title="item.title"
      :url="item.url"
      :folder-label="formatFolderPath(item.folderPath)"
      :source-root="item.sourceRoot"
      :open-count="item.openCount"
      :show-open-count="showOpenCount"
      :is-pinned="item.isPinned"
      :active="active"
    />
  </button>
</article>
```

- [ ] **Step 2: 去掉封面渐变和浮层，重排卡片信息**

`src/bookmarks/components/BookmarkCover.vue`

```vue
const siteLabel = computed(() => {
  try {
    return new URL(props.url).host
  } catch {
    return props.url
  }
})
```

```vue
<div class="bookmark-cover" :class="{ 'bookmark-cover--active': active }">
  <div class="bookmark-cover__top">
    <BookmarkAvatar :title="title" :url="url" :size="42" />
    <div class="bookmark-cover__meta">
      <p class="bookmark-cover__root">{{ sourceRoot }}</p>
      <p class="bookmark-cover__site" :title="siteLabel">{{ siteLabel }}</p>
    </div>
  </div>

  <div class="bookmark-cover__body">
    <h3 class="bookmark-cover__title" :title="title">{{ title }}</h3>
    <p class="bookmark-cover__url" :title="url">{{ url }}</p>
  </div>

  <div class="bookmark-cover__footer">
    <p class="bookmark-cover__folder" :title="folderLabel">PATH {{ folderLabel }}</p>
    <div class="bookmark-cover__metrics">
      <span class="bookmark-cover__chip" :class="{ 'bookmark-cover__chip--active': isPinned }">
        {{ isPinned ? 'PINNED' : 'READY' }}
      </span>
      <span v-if="showOpenCount && openCount > 0" class="bookmark-cover__count">
        OPEN {{ openCount }}
      </span>
    </div>
  </div>
</div>
```

- [ ] **Step 3: 把头像改成单色设备标签**

`src/bookmarks/components/BookmarkAvatar.vue`

```vue
const avatarStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}))
```

```vue
<div class="bookmark-avatar" :style="avatarStyle" aria-hidden="true">
  <span class="bookmark-avatar__letter">{{ avatarLetter }}</span>
</div>
```

- [ ] **Step 4: 跑构建确认组件模板与脚本一致**

Run: `npm run build`  
Expected: PASS；如果失败，优先修正移除 `coverStyle` 和旧类名后产生的未定义变量问题。

- [ ] **Step 5: Commit**

```bash
git add src/bookmarks/components/BookmarkCard.vue src/bookmarks/components/BookmarkCover.vue src/bookmarks/components/BookmarkAvatar.vue
git commit -m "feat: 重构书签卡片为单色面板风格"
```

## Task 5: 用全局 token 和组件样式落地 Nothing 风格

**Files:**
- Modify: `src/main.css`

- [ ] **Step 1: 在全局样式里引入字体和主题 token**

```css
@import url('https://fonts.googleapis.com/css2?family=Doto:wght@400..700&family=Space+Grotesk:wght@300;400;500;700&family=Space+Mono:wght@400;700&display=swap');

:root {
  color-scheme: light;
  --bg: #f5f5f5;
  --surface: #ffffff;
  --surface-raised: #f0f0f0;
  --border: #e8e8e8;
  --border-visible: #cccccc;
  --text-disabled: #999999;
  --text-secondary: #666666;
  --text-primary: #1a1a1a;
  --text-display: #000000;
  --accent: #d71921;
  --accent-soft: rgba(215, 25, 33, 0.14);
}

:root[data-theme='dark'] {
  color-scheme: dark;
  --bg: #000000;
  --surface: #111111;
  --surface-raised: #1a1a1a;
  --border: #222222;
  --border-visible: #333333;
  --text-disabled: #666666;
  --text-secondary: #999999;
  --text-primary: #e8e8e8;
  --text-display: #ffffff;
  --accent: #d71921;
  --accent-soft: rgba(215, 25, 33, 0.15);
}
```

- [ ] **Step 2: 用新 token 重写页面和组件样式**

```css
body {
  margin: 0;
  background: var(--bg);
  color: var(--text-primary);
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
}

.mono-label,
.status-chip,
.field-label,
.bookmark-cover__root,
.bookmark-cover__count,
.bookmark-card__pin-text,
.segmented-control__button,
.technical-button {
  font-family: 'Space Mono', monospace;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.8fr);
  gap: 24px;
  padding: 28px;
  border: 1px solid var(--border-visible);
  border-radius: 16px;
  background: var(--surface);
}

.hero__number {
  font-family: 'Doto', 'Space Mono', monospace;
  font-size: clamp(72px, 10vw, 120px);
  line-height: 0.92;
  color: var(--text-display);
}

.state-strip,
.bookmarks-section,
.settings-card,
.settings-panel,
.bookmark-cover {
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: none;
}

.state-strip--active,
.bookmark-card--active .bookmark-cover,
.bookmark-card__open:focus-visible .bookmark-cover {
  border-color: var(--accent);
}

.segmented-control {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 6px;
  border: 1px solid var(--border-visible);
  border-radius: 999px;
}

.segmented-control__button--active {
  background: var(--text-display);
  color: var(--bg);
}

.technical-button,
.secondary-button,
.primary-button {
  min-height: 44px;
  border-radius: 999px;
  border: 1px solid var(--border-visible);
  background: transparent;
  color: var(--text-primary);
  transition: border-color 180ms ease, color 180ms ease, background-color 180ms ease, opacity 180ms ease;
}

.technical-button:hover,
.secondary-button:hover,
.primary-button:hover {
  border-color: var(--text-primary);
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition: none !important;
    animation: none !important;
  }
}
```

- [ ] **Step 3: 跑一次构建确认 CSS 类名和模板一致**

Run: `npm run build`  
Expected: PASS；构建产物中不再出现旧的彩色渐变风格关键样式，页面仍可正常打包。

- [ ] **Step 4: Commit**

```bash
git add src/main.css
git commit -m "feat: 落地 Nothing 风格主题样式"
```

## Task 6: 更新文档并做最终验证

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: 更新 README 的能力说明**

`README.md`

```md
## 当前能力

- 支持 `跟随系统 / 深色 / 浅色` 三态主题
- 首页和设置页统一为 Nothing 风格黑白工业感界面
- 首页以卡片方式展示解析后的书签
- 使用 uTools 顶部输入框实时搜索 `标题 / URL / 目录路径`
- 支持方向键切换高亮卡片，回车直接打开书签
- 支持插件内置顶 / 取消置顶
- 支持记录最近打开与打开次数
```

- [ ] **Step 2: 更新 AGENTS 的协作快照和 smoke test**

`AGENTS.md`

```md
- 当前真实能力：
  - 支持在设置页切换 `跟随系统 / 深色 / 浅色`
  - 首页和设置页已切换到 Nothing 风格界面

- `src/App.vue`
  当前插件 UI 总入口，负责首页 / 设置页双视图切换、uTools 顶部输入搜索、高亮索引、本地状态整合和主题生效。

- `src/bookmarks/theme.js`
  负责主题模式解析和系统主题回退逻辑。
```

smoke test 增加：

```md
15. 在设置页切换 `跟随系统 / 深色 / 浅色`，确认首页立即响应
16. 系统处于深色模式时，选择 `跟随系统` 后重进插件，确认仍为深色
17. 系统处于浅色模式时，选择 `跟随系统` 后重进插件，确认仍为浅色
```

- [ ] **Step 3: 运行自动验证**

Run: `npm test && npm run build`  
Expected: 全部 PASS；如果失败，先修复测试或构建回归，不进入手动 smoke。

- [ ] **Step 4: 做一轮手动 smoke**

Run:

```bash
npm run dev
```

Manual smoke:

1. 在 uTools 开发者工具接入 `public/plugin.json`
2. 输入 `书签` 或 `快捷书签` 打开插件
3. 确认首页 hero 数字、路径摘要、设置入口和搜索状态条正常显示
4. 切换 `SYSTEM / DARK / LIGHT`，确认首页与设置页即时变更
5. 在顶部输入框输入关键字，确认高亮态、结果区块和状态条在深浅主题下都清晰
6. 方向键移动高亮，确认当前卡片存在明确红线或红点提示
7. 点置顶、打开书签、查看最近打开和打开次数，确认深浅主题下都没有对比度问题
8. 设置错误路径，确认内联 `[ ERROR: ... ]` 文案可读

- [ ] **Step 5: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs: 更新主题模式与界面重构说明"
```
