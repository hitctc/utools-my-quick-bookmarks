<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import HomeView from './bookmarks/HomeView.vue'
import SettingsView from './bookmarks/SettingsView.vue'
import {
  getBookmarkSearchMeta,
  normalizeSearchTokens,
} from './bookmarks/search.js'
import {
  formatThemeStatus,
  resolveThemeMode,
  SYSTEM_THEME_QUERY,
} from './bookmarks/theme.js'
import type {
  BookmarkCardEntry,
  BookmarkCardItem,
  BookmarkItem,
  BookmarkRecentRecord,
  BookmarkSection,
  BookmarkResolvedTheme,
  BookmarkUiSettings,
  BookmarkThemeMode,
  BookmarkSourceRoot,
} from './bookmarks/types'

type BookmarkLoadResult = {
  filePath: string
  total: number
  items: BookmarkItem[]
}

type BookmarkUiSettingsPatch = Partial<BookmarkUiSettings>
type PinnedBookmarkMap = Record<string, number>
type RecentOpenedMap = Record<string, BookmarkRecentRecord>

const currentView = ref<'home' | 'settings'>('home')
const bookmarkPath = ref('')
const items = ref<BookmarkItem[]>([])
const total = ref(0)
const loading = ref(false)
const saving = ref(false)
const homeError = ref('')
const settingsError = ref('')
const bootstrapped = ref(false)
const searchQuery = ref('')
const highlightedIndex = ref(0)
const uiSettings = ref<BookmarkUiSettings>({
  showRecentOpened: true,
  showOpenCount: true,
  themeMode: 'system',
})
const prefersDark = ref(false)
const pinnedMap = ref<PinnedBookmarkMap>({})
const recentOpenedMap = ref<RecentOpenedMap>({})
const systemThemeQuery = ref<MediaQueryList | null>(null)

// 统一把底层解析结果整理成首页卡片模型，避免展示层重复拼字段。
function normalizeBookmarkItem(item: BookmarkItem): BookmarkItem {
  const fallbackId = `${item?.url || 'bookmark'}-${item?.dateAdded || '0'}`

  return {
    id: String(item?.id ?? fallbackId),
    title: String(item?.title ?? '').trim(),
    url: String(item?.url ?? '').trim(),
    folderPath: Array.isArray(item?.folderPath) ? item.folderPath : [],
    sourceRoot: ['bookmark_bar', 'other', 'synced'].includes(String(item?.sourceRoot))
      ? (item.sourceRoot as BookmarkSourceRoot)
      : 'bookmark_bar',
    dateAdded: String(item?.dateAdded ?? ''),
  }
}

// 系统主题状态只要跟浏览器媒体查询同步一次，后续就由监听器保持更新。
function syncPrefersDarkState(queryList: MediaQueryList | MediaQueryListEvent | null) {
  if (!queryList) {
    prefersDark.value = false
    return
  }

  prefersDark.value = Boolean('matches' in queryList ? queryList.matches : false)
}

// 兼容新旧 MediaQueryList API，确保系统主题切换时都能收到变化。
function attachSystemThemeListener(queryList: MediaQueryList) {
  if ('addEventListener' in queryList) {
    queryList.addEventListener('change', syncPrefersDarkState)
    return
  }

  queryList.addListener(syncPrefersDarkState)
}

// 解除监听时也要兼容新旧 API，不然 uTools 里多次进入会堆积回调。
function detachSystemThemeListener(queryList: MediaQueryList) {
  if ('removeEventListener' in queryList) {
    queryList.removeEventListener('change', syncPrefersDarkState)
    return
  }

  queryList.removeListener(syncPrefersDarkState)
}

// 置顶区要把已置顶书签按置顶时间排好，避免每次刷新顺序乱跳。
function sortPinnedItems(left: BookmarkCardItem, right: BookmarkCardItem) {
  const leftPinnedAt = Number(pinnedMap.value[left.id] || 0)
  const rightPinnedAt = Number(pinnedMap.value[right.id] || 0)
  return leftPinnedAt - rightPinnedAt
}

// 最近打开区按最后打开时间倒序展示，时间相同再比较打开次数。
function sortRecentItems(left: BookmarkCardItem, right: BookmarkCardItem) {
  const leftRecord = recentOpenedMap.value[left.id]
  const rightRecord = recentOpenedMap.value[right.id]
  const leftOpenedAt = Number(leftRecord?.openedAt || 0)
  const rightOpenedAt = Number(rightRecord?.openedAt || 0)

  if (leftOpenedAt !== rightOpenedAt) {
    return rightOpenedAt - leftOpenedAt
  }

  return Number(rightRecord?.openCount || 0) - Number(leftRecord?.openCount || 0)
}

// 区块里的卡片要带上稳定 key，这样键盘高亮命中的是具体卡片位置而不是纯书签 id。
function buildSectionEntries(sectionKey: string, list: BookmarkCardItem[]): BookmarkCardEntry[] {
  return list.map((item, index) => ({
    cardKey: `${sectionKey}:${item.id}:${index}`,
    item,
  }))
}

// 只有读到一份完整可用的书签结果后，才把它应用到首页状态里。
function applyBookmarkLoadResult(result: BookmarkLoadResult) {
  bookmarkPath.value = result.filePath
  items.value = result.items.map(normalizeBookmarkItem)
  total.value = result.total
}

// 先验证路径是否真的可读，再决定要不要把结果写进当前状态或持久化配置。
function validateChromeBookmarks(nextPath: string) {
  return window.services.loadChromeBookmarks(nextPath) as BookmarkLoadResult
}

// 顶部输入框只在首页工作，进入设置页后需要还原成普通状态。
function syncSubInput() {
  if (!window.utools?.setSubInput || !window.utools?.removeSubInput) {
    return
  }

  if (currentView.value !== 'home' || !bootstrapped.value) {
    window.utools.removeSubInput()
    return
  }

  window.utools.setSubInput(
    ({ text }) => {
      searchQuery.value = String(text || '')
      highlightedIndex.value = 0
    },
    '搜索书签标题、网址或目录',
    true,
  )

  if (window.utools.setSubInputValue) {
    window.utools.setSubInputValue(searchQuery.value)
  }
}

// 键盘导航始终对当前可见卡片生效，回车直接复用同一套打开逻辑。
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
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    window.utools?.subInputBlur?.()
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const current = entries[highlightedIndex.value]
    if (current) {
      handleOpenBookmark(current.item)
    }
  } else if (event.key === 'Escape') {
    window.utools?.subInputFocus?.()
  }
}

// 统一根据路径加载书签，并把错误落到当前所在视图。
function loadBookmarks(nextPath = bookmarkPath.value, targetView: 'home' | 'settings' = currentView.value) {
  const errorRef = targetView === 'settings' ? settingsError : homeError
  loading.value = true
  errorRef.value = ''

  try {
    applyBookmarkLoadResult(validateChromeBookmarks(nextPath))
  } catch (error) {
    errorRef.value = error instanceof Error ? error.message : '读取书签文件失败'
    items.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

// 初始化当前生效路径，并在插件真正进入时触发首次读取。
function initializeApp() {
  currentView.value = 'home'
  homeError.value = ''
  settingsError.value = ''
  searchQuery.value = ''
  highlightedIndex.value = 0

  if (!window.utools || !window.services) {
    homeError.value = '请通过 uTools 接入开发模式打开当前插件'
    return
  }

  const settings = window.services.getBookmarkSettings() as { chromeBookmarksPath: string }
  uiSettings.value = window.services.getBookmarkUiSettings() as BookmarkUiSettings
  pinnedMap.value = window.services.getPinnedBookmarks() as PinnedBookmarkMap
  recentOpenedMap.value = window.services.getRecentOpenedBookmarks() as RecentOpenedMap
  bookmarkPath.value = settings.chromeBookmarksPath
  loadBookmarks(settings.chromeBookmarksPath, 'home')
  bootstrapped.value = true
  syncSubInput()
}

// 保存路径后立即重新解析；只有重新解析成功时才返回首页。
function saveSettings(nextPath: string) {
  saving.value = true
  settingsError.value = ''

  try {
    const loaded = validateChromeBookmarks(nextPath)
    const settings = window.services.saveBookmarkSettings(loaded.filePath) as { chromeBookmarksPath: string }
    applyBookmarkLoadResult(loaded)
    bookmarkPath.value = settings.chromeBookmarksPath
    currentView.value = 'home'
    syncSubInput()
  } catch (error) {
    settingsError.value = error instanceof Error ? error.message : '读取书签文件失败'
  } finally {
    saving.value = false
  }
}

// 恢复默认路径时只更新表单值，是否正式生效由保存或重新读取决定。
function resetSettings() {
  saving.value = true
  settingsError.value = ''

  try {
    const settings = window.services.resetBookmarkSettings() as { chromeBookmarksPath: string }
    bookmarkPath.value = settings.chromeBookmarksPath
  } finally {
    saving.value = false
  }
}

// 允许用户在设置页用当前输入值手动试读，不强制先保存。
function reloadFromSettings(nextPath: string) {
  settingsError.value = ''

  try {
    applyBookmarkLoadResult(validateChromeBookmarks(nextPath))
  } catch (error) {
    settingsError.value = error instanceof Error ? error.message : '读取书签文件失败'
  }
}

// 设置页的展示开关即时持久化，首页读取的是同一份本地状态。
function changeUiSettings(patch: BookmarkUiSettingsPatch) {
  uiSettings.value = window.services.saveBookmarkUiSettings(patch) as BookmarkUiSettings
}

// 置顶只影响插件内展示顺序，不会改 Chrome 源书签文件。
function handleTogglePin(item: BookmarkCardItem) {
  pinnedMap.value = window.services.togglePinnedBookmarkState(item.id) as PinnedBookmarkMap
}

// 打开书签时同时更新最近打开和打开次数，首页状态即时跟上。
function handleOpenBookmark(item: BookmarkCardItem) {
  homeError.value = ''

  try {
    recentOpenedMap.value = window.services.openBookmarkUrl(item.id, item.url) as RecentOpenedMap
  } catch (error) {
    homeError.value = error instanceof Error ? error.message : '打开书签失败'
  }
}

const themeMode = computed<BookmarkThemeMode>(() => uiSettings.value.themeMode)
const resolvedTheme = computed<BookmarkResolvedTheme>(() =>
  resolveThemeMode(themeMode.value, prefersDark.value),
)
const themeStatus = computed(() => formatThemeStatus(themeMode.value, resolvedTheme.value))
const searchTokens = computed(() => normalizeSearchTokens(searchQuery.value))

const mergedItems = computed<BookmarkCardItem[]>(() =>
  items.value.map(item => {
    const recentRecord = recentOpenedMap.value[item.id]
    return {
      ...item,
      title: item.title || '未命名书签',
      isPinned: Boolean(pinnedMap.value[item.id]),
      openCount: Number(recentRecord?.openCount || 0),
    }
  }),
)

const searchableItems = computed(() => {
  if (!searchTokens.value.length) {
    return mergedItems.value
  }

  return mergedItems.value.filter(item => getBookmarkSearchMeta(item, searchTokens.value).matches)
})

const pinnedItems = computed(() =>
  mergedItems.value.filter(item => item.isPinned).sort(sortPinnedItems),
)

const recentItems = computed(() =>
  mergedItems.value
    .filter(item => Boolean(recentOpenedMap.value[item.id]))
    .sort(sortRecentItems),
)

const regularItems = computed(() =>
  mergedItems.value.filter(item => !item.isPinned),
)

const visibleSections = computed<BookmarkSection[]>(() => {
  const query = searchQuery.value.trim()
  if (searchTokens.value.length) {
    return searchableItems.value.length
      ? [
          {
            key: 'search',
            title: '搜索结果',
            entries: buildSectionEntries('search', searchableItems.value),
          },
        ]
      : []
  }

  const sections: BookmarkSection[] = []

  if (pinnedItems.value.length) {
    sections.push({
      key: 'pinned',
      title: '置顶',
      entries: buildSectionEntries('pinned', pinnedItems.value),
    })
  }

  if (uiSettings.value.showRecentOpened && recentItems.value.length) {
    sections.push({
      key: 'recent',
      title: '最近打开',
      entries: buildSectionEntries('recent', recentItems.value),
    })
  }

  if (regularItems.value.length) {
    sections.push({
      key: 'all',
      title: '全部书签',
      entries: buildSectionEntries('all', regularItems.value),
    })
  }

  return sections
})

const visibleEntries = computed(() => visibleSections.value.flatMap(section => section.entries))

const highlightedCardKey = computed(() => {
  if (!visibleEntries.value.length) {
    return ''
  }

  const safeIndex = Math.min(highlightedIndex.value, visibleEntries.value.length - 1)
  return visibleEntries.value[safeIndex]?.cardKey || ''
})

const emptyText = computed(() => {
  if (searchQuery.value.trim()) {
    return `没有找到和“${searchQuery.value.trim()}”匹配的书签。`
  }

  return '当前没有可展示的书签结果。'
})

watch(
  resolvedTheme,
  value => {
    if (typeof document === 'undefined') {
      return
    }

    document.documentElement.dataset.theme = value
  },
  { immediate: true },
)

watch(currentView, () => {
  syncSubInput()
})

watch(visibleEntries, entries => {
  if (!entries.length) {
    highlightedIndex.value = 0
    return
  }

  highlightedIndex.value = Math.min(highlightedIndex.value, entries.length - 1)
})

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown)

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    systemThemeQuery.value = window.matchMedia(SYSTEM_THEME_QUERY)
    syncPrefersDarkState(systemThemeQuery.value)
    attachSystemThemeListener(systemThemeQuery.value)
  }

  if (!window.utools?.onPluginEnter) {
    initializeApp()
    return
  }

  window.utools.onPluginEnter(() => {
    initializeApp()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown)
  if (systemThemeQuery.value) {
    detachSystemThemeListener(systemThemeQuery.value)
    systemThemeQuery.value = null
  }
  window.utools?.removeSubInput?.()
})
</script>

<template>
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
  <SettingsView
    v-else
    :model-value="bookmarkPath"
    :show-recent-opened="uiSettings.showRecentOpened"
    :show-open-count="uiSettings.showOpenCount"
    :theme-mode="themeMode"
    :saving="saving"
    :error="settingsError"
    @back="currentView = 'home'"
    @save="saveSettings"
    @reset="resetSettings"
    @reload="reloadFromSettings"
    @change-ui-settings="changeUiSettings"
  />
</template>
