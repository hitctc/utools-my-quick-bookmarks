const fs = require('node:fs')
const os = require('node:os')
const {
  getDefaultChromeBookmarksPath,
  getEffectiveChromeBookmarksPath,
  parseChromeBookmarksText,
} = require('./chromeBookmarks.cjs')

const BOOKMARK_SETTINGS_KEY = 'quick-bookmarks-settings'

// 读取本地保存的书签路径配置；如果用户还没配过，就回退到默认 Chrome 路径。
function getBookmarkSettings() {
  const saved = window.utools.dbStorage.getItem(BOOKMARK_SETTINGS_KEY) || {}
  const chromeBookmarksPath = getEffectiveChromeBookmarksPath(
    os.homedir(),
    saved.chromeBookmarksPath,
  )

  return {
    chromeBookmarksPath,
  }
}

// 保存用户自定义的书签路径，并返回当前生效的设置。
function saveBookmarkSettings(chromeBookmarksPath) {
  const payload = {
    chromeBookmarksPath: String(chromeBookmarksPath ?? '').trim(),
  }

  window.utools.dbStorage.setItem(BOOKMARK_SETTINGS_KEY, payload)
  return getBookmarkSettings()
}

// 清除用户自定义路径，恢复为默认 Chrome 路径。
function resetBookmarkSettings() {
  window.utools.dbStorage.removeItem(BOOKMARK_SETTINGS_KEY)
  return getBookmarkSettings()
}

// 读取并解析 Chrome 书签文件，把底层文件或 JSON 异常整理成前端可展示的错误信息。
function loadChromeBookmarks(bookmarkPath) {
  const filePath = getEffectiveChromeBookmarksPath(os.homedir(), bookmarkPath)

  if (!fs.existsSync(filePath)) {
    throw new Error('当前书签文件路径不存在或不可访问')
  }

  let text = ''
  try {
    text = fs.readFileSync(filePath, { encoding: 'utf-8' })
  } catch {
    throw new Error('当前书签文件路径不存在或不可访问')
  }

  let parsed
  try {
    parsed = parseChromeBookmarksText(text)
  } catch {
    throw new Error('书签文件不是有效的 Chrome Bookmarks JSON')
  }

  if (!parsed.items.length) {
    throw new Error('已读取文件，但没有解析出任何书签')
  }

  return {
    filePath,
    total: parsed.total,
    items: parsed.items,
  }
}

// 通过 window 对象向渲染进程注入当前书签工具需要的本地能力。
window.services = {
  getDefaultChromeBookmarksPath() {
    return getDefaultChromeBookmarksPath(os.homedir())
  },
  getBookmarkSettings,
  saveBookmarkSettings,
  resetBookmarkSettings,
  loadChromeBookmarks,
}
