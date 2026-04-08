<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import HomeView from './bookmarks/HomeView.vue'
import SettingsView from './bookmarks/SettingsView.vue'

type BookmarkItem = {
  id: string
  title: string
  url: string
  folderPath: string[]
  sourceRoot: 'bookmark_bar' | 'other' | 'synced'
  dateAdded: string
}

type BookmarkLoadResult = {
  filePath: string
  total: number
  items: BookmarkItem[]
}

const currentView = ref<'home' | 'settings'>('home')
const bookmarkPath = ref('')
const items = ref<BookmarkItem[]>([])
const total = ref(0)
const loading = ref(false)
const saving = ref(false)
const homeError = ref('')
const settingsError = ref('')
const bootstrapped = ref(false)

// 统一根据路径加载书签，并把错误落到当前所在视图。
function loadBookmarks(nextPath = bookmarkPath.value, targetView: 'home' | 'settings' = currentView.value) {
  const errorRef = targetView === 'settings' ? settingsError : homeError
  loading.value = true
  errorRef.value = ''

  try {
    const result = window.services.loadChromeBookmarks(nextPath) as BookmarkLoadResult
    bookmarkPath.value = result.filePath
    items.value = result.items
    total.value = result.total
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

  if (!window.utools || !window.services) {
    homeError.value = '请通过 uTools 接入开发模式打开当前插件'
    return
  }

  const settings = window.services.getBookmarkSettings() as { chromeBookmarksPath: string }
  bookmarkPath.value = settings.chromeBookmarksPath
  loadBookmarks(settings.chromeBookmarksPath, 'home')
  bootstrapped.value = true
}

// 保存路径后立即重新解析；只有重新解析成功时才返回首页。
function saveSettings(nextPath: string) {
  saving.value = true
  settingsError.value = ''

  try {
    const settings = window.services.saveBookmarkSettings(nextPath) as { chromeBookmarksPath: string }
    bookmarkPath.value = settings.chromeBookmarksPath
    loadBookmarks(settings.chromeBookmarksPath, 'settings')
    if (!settingsError.value) {
      currentView.value = 'home'
    }
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
  loadBookmarks(nextPath, 'settings')
}

onMounted(() => {
  if (!window.utools?.onPluginEnter) {
    initializeApp()
    return
  }

  window.utools.onPluginEnter(() => {
    initializeApp()
  })
})
</script>

<template>
  <HomeView
    v-if="currentView === 'home'"
    :bookmark-path="bookmarkPath"
    :bootstrapped="bootstrapped"
    :loading="loading"
    :error="homeError"
    :items="items"
    :total="total"
    @open-settings="currentView = 'settings'"
  />
  <SettingsView
    v-else
    :model-value="bookmarkPath"
    :saving="saving"
    :error="settingsError"
    @back="currentView = 'home'"
    @save="saveSettings"
    @reset="resetSettings"
    @reload="reloadFromSettings"
  />
</template>
