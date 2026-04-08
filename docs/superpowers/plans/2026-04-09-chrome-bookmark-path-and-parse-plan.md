# Chrome 书签路径配置与解析 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 macOS 下默认读取 Google Chrome 的 `Default/Bookmarks` 文件，支持在应用内修改路径，并把解析出的书签结果展示在首页。

**Architecture:** 解析逻辑和默认路径逻辑收口到 `public/preload/chromeBookmarks.cjs` 这个纯 Node 模块，用 `node:test` 做最小单测；`public/preload/services.js` 只负责桥接 `utools.dbStorage` 和文件读取；前端通过 `src/App.vue + src/bookmarks/*` 实现“首页 / 设置页”双视图，不引入路由。

**Tech Stack:** Vue 3 + Vite 6 + uTools preload + Node.js `fs/path/os` + `utools.dbStorage` + Node built-in `node:test`

---

## File Structure

- Create: `public/preload/chromeBookmarks.cjs`
  负责默认路径计算、Chrome `Bookmarks` JSON 解析、递归拍平 folder/url 结构。
- Create: `tests/preload/chromeBookmarks.test.mjs`
  负责纯解析逻辑和默认路径逻辑的最小单测。
- Create: `src/bookmarks/HomeView.vue`
  首页视图，展示标题、设置入口、路径摘要、错误态和书签列表。
- Create: `src/bookmarks/SettingsView.vue`
  设置视图，展示和编辑书签文件路径，保存、恢复默认路径、重新读取。
- Modify: `package.json`
  增加 `test` 脚本，保留现有 `dev/build`。
- Modify: `public/preload/services.js`
  暴露 bookmark settings 和 bookmark load API。
- Modify: `public/plugin.json`
  移除模板 `hello/read/write` feature，改成书签工具实际入口。
- Modify: `src/App.vue`
  从模板式 route 分发改成业务主入口，管理 `home/settings` 状态和加载流程。
- Modify: `src/main.css`
  补当前两页需要的基础样式。
- Modify: `README.md`
  更新为真实能力说明和开发步骤。
- Modify: `AGENTS.md`
  更新项目阶段、feature 列表、目录职责、验证方式和已知限制。

## Task 1: 建立默认路径与 JSON 解析模块

**Files:**
- Create: `public/preload/chromeBookmarks.cjs`
- Create: `tests/preload/chromeBookmarks.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: 写失败中的解析测试**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  getDefaultChromeBookmarksPath,
  parseChromeBookmarksText,
} = require('../../public/preload/chromeBookmarks.cjs')

test('getDefaultChromeBookmarksPath returns macOS Chrome default bookmark path', () => {
  const result = getDefaultChromeBookmarksPath('/Users/demo')

  assert.equal(
    result,
    '/Users/demo/Library/Application Support/Google/Chrome/Default/Bookmarks',
  )
})

test('parseChromeBookmarksText flattens bookmark_bar, other and synced url nodes', () => {
  const sample = JSON.stringify({
    roots: {
      bookmark_bar: {
        children: [
          {
            type: 'folder',
            name: 'Work',
            children: [
              {
                id: '11',
                type: 'url',
                name: 'OpenAI',
                url: 'https://openai.com',
                date_added: '1',
              },
            ],
          },
        ],
      },
      other: {
        children: [
          {
            id: '12',
            type: 'url',
            name: 'GitHub',
            url: 'https://github.com',
            date_added: '2',
          },
        ],
      },
      synced: {
        children: [
          {
            id: '13',
            type: 'url',
            name: '',
            url: 'https://example.com',
            date_added: '3',
          },
        ],
      },
    },
  })

  const result = parseChromeBookmarksText(sample)

  assert.equal(result.total, 3)
  assert.deepEqual(
    result.items.map(item => ({
      id: item.id,
      title: item.title,
      folderPath: item.folderPath,
      sourceRoot: item.sourceRoot,
    })),
    [
      { id: '11', title: 'OpenAI', folderPath: ['Work'], sourceRoot: 'bookmark_bar' },
      { id: '12', title: 'GitHub', folderPath: [], sourceRoot: 'other' },
      { id: '13', title: '', folderPath: [], sourceRoot: 'synced' },
    ],
  )
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/preload/chromeBookmarks.test.mjs`  
Expected: FAIL，原因是 `../../public/preload/chromeBookmarks.cjs` 尚不存在。

- [ ] **Step 3: 增加测试脚本**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "node --test tests/**/*.test.mjs"
  }
}
```

- [ ] **Step 4: 实现最小解析模块**

```js
const path = require('node:path')

function getDefaultChromeBookmarksPath(homeDir) {
  return path.join(
    homeDir,
    'Library',
    'Application Support',
    'Google',
    'Chrome',
    'Default',
    'Bookmarks',
  )
}

function flattenNodes(nodes, sourceRoot, folderPath = []) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return []
  }

  return nodes.flatMap(node => {
    if (!node || typeof node !== 'object') {
      return []
    }

    if (node.type === 'folder') {
      const nextFolderPath = node.name ? [...folderPath, node.name] : folderPath
      return flattenNodes(node.children, sourceRoot, nextFolderPath)
    }

    if (node.type !== 'url' || typeof node.url !== 'string' || node.url.length === 0) {
      return []
    }

    return [
      {
        id: String(node.id ?? ''),
        title: typeof node.name === 'string' ? node.name : '',
        url: node.url,
        folderPath,
        sourceRoot,
        dateAdded: typeof node.date_added === 'string' ? node.date_added : '',
      },
    ]
  })
}

function parseChromeBookmarksText(text) {
  const json = JSON.parse(text)
  const items = [
    ...flattenNodes(json?.roots?.bookmark_bar?.children, 'bookmark_bar'),
    ...flattenNodes(json?.roots?.other?.children, 'other'),
    ...flattenNodes(json?.roots?.synced?.children, 'synced'),
  ]

  return {
    total: items.length,
    items,
  }
}

module.exports = {
  getDefaultChromeBookmarksPath,
  parseChromeBookmarksText,
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm test`  
Expected: PASS，至少包含 `2` 个通过的测试。

- [ ] **Step 6: Commit**

```bash
git add package.json public/preload/chromeBookmarks.cjs tests/preload/chromeBookmarks.test.mjs
git commit -m "feat: 增加 Chrome 书签解析模块"
```

## Task 2: 接通 preload 设置存储与文件读取

**Files:**
- Modify: `public/preload/chromeBookmarks.cjs`
- Modify: `public/preload/services.js`
- Test: `tests/preload/chromeBookmarks.test.mjs`

- [ ] **Step 1: 给“已保存路径优先、否则回退默认路径”写失败测试**

```js
const {
  getDefaultChromeBookmarksPath,
  getEffectiveChromeBookmarksPath,
  parseChromeBookmarksText,
} = require('../../public/preload/chromeBookmarks.cjs')

test('getEffectiveChromeBookmarksPath prefers saved path when non-empty', () => {
  const result = getEffectiveChromeBookmarksPath('/Users/demo', '  /tmp/custom-bookmarks  ')

  assert.equal(result, '/tmp/custom-bookmarks')
})

test('getEffectiveChromeBookmarksPath falls back to default path when saved path is empty', () => {
  const result = getEffectiveChromeBookmarksPath('/Users/demo', '   ')

  assert.equal(
    result,
    '/Users/demo/Library/Application Support/Google/Chrome/Default/Bookmarks',
  )
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`  
Expected: FAIL，原因是 `getEffectiveChromeBookmarksPath` 尚不存在。

- [ ] **Step 3: 在解析模块里补最小路径决策逻辑**

```js
function getEffectiveChromeBookmarksPath(homeDir, savedPath) {
  const trimmed = typeof savedPath === 'string' ? savedPath.trim() : ''
  return trimmed || getDefaultChromeBookmarksPath(homeDir)
}

module.exports = {
  getDefaultChromeBookmarksPath,
  getEffectiveChromeBookmarksPath,
  parseChromeBookmarksText,
}
```

- [ ] **Step 4: 扩展 preload 服务**

```js
const fs = require('node:fs')
const os = require('node:os')
const {
  getDefaultChromeBookmarksPath,
  getEffectiveChromeBookmarksPath,
  parseChromeBookmarksText,
} = require('./chromeBookmarks.cjs')

const BOOKMARK_SETTINGS_KEY = 'quick-bookmarks-settings'

function getBookmarkSettings() {
  const saved = window.utools.dbStorage.getItem(BOOKMARK_SETTINGS_KEY) || {}
  const homeDir = os.homedir()
  const chromeBookmarksPath = getEffectiveChromeBookmarksPath(homeDir, saved.chromeBookmarksPath)

  return {
    chromeBookmarksPath,
  }
}

function saveBookmarkSettings(chromeBookmarksPath) {
  const payload = {
    chromeBookmarksPath: String(chromeBookmarksPath ?? '').trim(),
  }
  window.utools.dbStorage.setItem(BOOKMARK_SETTINGS_KEY, payload)
  return getBookmarkSettings()
}

function resetBookmarkSettings() {
  window.utools.dbStorage.removeItem(BOOKMARK_SETTINGS_KEY)
  return getBookmarkSettings()
}

function loadChromeBookmarks(bookmarkPath) {
  const filePath = getEffectiveChromeBookmarksPath(os.homedir(), bookmarkPath)
  const text = fs.readFileSync(filePath, { encoding: 'utf-8' })
  const parsed = parseChromeBookmarksText(text)

  return {
    filePath,
    total: parsed.total,
    items: parsed.items,
  }
}

window.services = {
  getDefaultChromeBookmarksPath: () => getDefaultChromeBookmarksPath(os.homedir()),
  getBookmarkSettings,
  saveBookmarkSettings,
  resetBookmarkSettings,
  loadChromeBookmarks,
}
```

- [ ] **Step 5: 运行测试确认仍然通过**

Run: `npm test`  
Expected: PASS，现有解析模块测试继续通过。

- [ ] **Step 6: 手动检查 preload 构建边界**

Run: `npm run build`  
Expected: PASS，`dist/preload/services.js` 与 `dist/preload/chromeBookmarks.cjs` 被正确产出。

- [ ] **Step 7: Commit**

```bash
git add public/preload/chromeBookmarks.cjs public/preload/services.js
git commit -m "feat: 接通书签路径配置和 preload 读取"
```

## Task 3: 替换模板入口并实现首页 / 设置页

**Files:**
- Create: `src/bookmarks/HomeView.vue`
- Create: `src/bookmarks/SettingsView.vue`
- Modify: `src/App.vue`
- Modify: `src/main.css`
- Modify: `public/plugin.json`

- [ ] **Step 1: 把插件入口从模板 feature 改成书签工具**

```json
{
  "features": [
    {
      "code": "bookmarks",
      "explain": "快速展示和配置 Google Chrome 书签文件",
      "cmds": [
        "书签",
        "快捷书签",
        "chrome书签"
      ]
    }
  ]
}
```

- [ ] **Step 2: 实现首页视图**

```vue
<script setup>
defineProps({
  bookmarkPath: { type: String, required: true },
  loading: { type: Boolean, required: true },
  error: { type: String, default: '' },
  items: { type: Array, required: true },
})

const emit = defineEmits(['open-settings'])

const formatFolderPath = folderPath =>
  Array.isArray(folderPath) && folderPath.length > 0 ? folderPath.join(' / ') : '未分类'
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <h1>我的快捷书签</h1>
        <p class="page-subtitle">当前路径：{{ bookmarkPath }}</p>
      </div>
      <button class="ghost-button" @click="emit('open-settings')">设置</button>
    </header>

    <div v-if="loading" class="panel">正在读取 Chrome 书签文件…</div>
    <div v-else-if="error" class="panel panel-error">{{ error }}</div>
    <div v-else class="bookmark-list">
      <article v-for="item in items" :key="`${item.sourceRoot}-${item.id}-${item.url}`" class="bookmark-item">
        <h2>{{ item.title || '未命名书签' }}</h2>
        <p class="bookmark-url">{{ item.url }}</p>
        <p class="bookmark-meta">目录：{{ formatFolderPath(item.folderPath) }}</p>
        <p class="bookmark-meta">来源：{{ item.sourceRoot }}</p>
      </article>
    </div>
  </section>
</template>
```

- [ ] **Step 3: 实现设置页**

```vue
<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, required: true },
  saving: { type: Boolean, required: true },
  error: { type: String, default: '' },
})

const emit = defineEmits(['back', 'save', 'reset', 'reload'])
const localPath = ref(props.modelValue)

watch(
  () => props.modelValue,
  value => {
    localPath.value = value
  },
)
</script>

<template>
  <section class="page">
    <header class="page-header">
      <button class="ghost-button" @click="emit('back')">返回</button>
      <h1>Chrome 书签文件设置</h1>
    </header>

    <div class="panel">
      <label class="field-label" for="bookmark-path">书签文件路径</label>
      <input id="bookmark-path" v-model="localPath" class="text-input" type="text" />
      <p class="field-hint">默认只适配 macOS 下的 Google Chrome 默认 profile，不是常用 profile 时请手动修改。</p>
      <p v-if="error" class="field-error">{{ error }}</p>
      <div class="button-row">
        <button class="primary-button" :disabled="saving" @click="emit('save', localPath)">保存</button>
        <button class="ghost-button" :disabled="saving" @click="emit('reset')">恢复默认路径</button>
        <button class="ghost-button" :disabled="saving" @click="emit('reload', localPath)">重新读取</button>
      </div>
    </div>
  </section>
  </template>
```

- [ ] **Step 4: 在 `src/App.vue` 里接通视图状态和加载流程**

```vue
<script setup>
import { onMounted, ref } from 'vue'
import HomeView from './bookmarks/HomeView.vue'
import SettingsView from './bookmarks/SettingsView.vue'

const currentView = ref('home')
const bookmarkPath = ref('')
const items = ref([])
const loading = ref(false)
const saving = ref(false)
const homeError = ref('')
const settingsError = ref('')

async function loadBookmarks(nextPath = bookmarkPath.value, targetView = currentView.value) {
  const targetError = targetView === 'settings' ? settingsError : homeError
  loading.value = true
  targetError.value = ''
  try {
    const result = await window.services.loadChromeBookmarks(nextPath)
    bookmarkPath.value = result.filePath
    items.value = result.items
  } catch (error) {
    targetError.value = error instanceof Error ? error.message : '读取书签文件失败'
  } finally {
    loading.value = false
  }
}

async function initialize() {
  const settings = await window.services.getBookmarkSettings()
  bookmarkPath.value = settings.chromeBookmarksPath
  await loadBookmarks(settings.chromeBookmarksPath, 'home')
}

async function saveSettings(nextPath) {
  saving.value = true
  settingsError.value = ''
  try {
    const settings = await window.services.saveBookmarkSettings(nextPath)
    bookmarkPath.value = settings.chromeBookmarksPath
    await loadBookmarks(settings.chromeBookmarksPath, 'settings')
    if (!settingsError.value) {
      currentView.value = 'home'
    }
  } finally {
    saving.value = false
  }
}

async function resetSettings() {
  saving.value = true
  settingsError.value = ''
  try {
    const settings = await window.services.resetBookmarkSettings()
    bookmarkPath.value = settings.chromeBookmarksPath
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  window.utools.onPluginEnter(() => {
    initialize()
  })
})
</script>
```

- [ ] **Step 5: 补基础样式，只做当前页面所需样式**

```css
body {
  margin: 0;
  background: #f5f7fb;
  color: #18212f;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

#app {
  min-height: 100vh;
}

.page {
  padding: 24px;
}

.page-header,
.button-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel,
.bookmark-item {
  background: #fff;
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 8px 24px rgba(24, 33, 47, 0.08);
}
```

- [ ] **Step 6: 运行构建检查**

Run: `npm run build`  
Expected: PASS，且 `dist/plugin.json` 只有书签工具实际入口，不再保留模板 `hello/read/write`。

- [ ] **Step 7: 手动 smoke test**

Run:
1. `npm run dev`
2. uTools 接入 `public/plugin.json`
3. 进入插件首页

Expected:
- 首页右上角能看到“设置”
- 首次自动尝试读取默认 Chrome 书签路径
- 点击“设置”可进入设置页并看到默认路径

- [ ] **Step 8: Commit**

```bash
git add public/plugin.json src/App.vue src/bookmarks/HomeView.vue src/bookmarks/SettingsView.vue src/main.css
git commit -m "feat: 增加书签首页和设置页"
```

## Task 4: 补文档并完成验证收口

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Test: `tests/preload/chromeBookmarks.test.mjs`

- [ ] **Step 1: 更新 README**

```md
# utools-my-quick-bookmarks

macOS 下读取 Google Chrome 默认书签文件的 uTools 工具。

## 当前能力

- 默认读取 `~/Library/Application Support/Google/Chrome/Default/Bookmarks`
- 首页展示解析后的书签列表
- 设置页支持修改书签文件路径并重新读取

## 开发

```bash
npm install
npm run dev
```
```

- [ ] **Step 2: 更新 AGENTS**

需要同步这些点：

- 项目从模板阶段进入“Chrome 书签文件读取与解析 MVP 阶段”
- `public/preload/chromeBookmarks.cjs` 的职责
- `src/bookmarks/` 目录职责
- `public/plugin.json` feature 已改成书签工具入口
- 新增 `npm test`
- 当前已知限制：只支持 macOS 的 Google Chrome 默认 profile，多个 Chrome / profile 需用户手动改路径

- [ ] **Step 3: 跑最终验证**

Run:

```bash
npm test
npm run build
```

Expected:
- `npm test` PASS
- `npm run build` PASS

- [ ] **Step 4: 跑最终手动 smoke test**

Expected:
- 默认路径能读到书签时，首页展示书签列表
- 把路径改错时，设置页原地显示错误
- 点击“恢复默认路径”后可重新回到默认路径

- [ ] **Step 5: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs: 同步书签工具说明"
```

## Self-Review

- Spec coverage:
  - 默认路径、可改路径、设置按钮、preload 解析、首页展示、错误态、已知限制，都分别落到了 Task 1-4。
- Placeholder scan:
  - 计划里没有未展开的占位语句。
- Type consistency:
  - 统一使用 `chromeBookmarksPath`、`loadChromeBookmarks`、`getBookmarkSettings`、`resetBookmarkSettings` 这组命名，避免后续任务命名漂移。
