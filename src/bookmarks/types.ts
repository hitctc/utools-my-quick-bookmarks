export type BookmarkSourceRoot = 'bookmark_bar' | 'other' | 'synced'
export type BookmarkThemeMode = 'system' | 'dark' | 'light'
export type BookmarkResolvedTheme = 'dark' | 'light'

export interface BookmarkItem {
  id: string
  title: string
  url: string
  folderPath: string[]
  sourceRoot: BookmarkSourceRoot
  dateAdded: string
}

export interface BookmarkCardItem extends BookmarkItem {
  isPinned: boolean
  openCount: number
}

export interface BookmarkRecentRecord {
  bookmarkId: string
  openedAt: number
  openCount: number
}

export interface BookmarkUiSettings {
  showRecentOpened: boolean
  showOpenCount: boolean
  themeMode: BookmarkThemeMode
  windowHeight: number
  lastSearchQuery: string
}

export interface BookmarkHighlightSegment {
  text: string
  matched: boolean
}

export interface BookmarkSearchMeta {
  matches: boolean
  urlOnlyMatch: boolean
  primaryMatchLabel: string
  primaryMatchToken: string
  title: string
  url: string
  folderLabel: string
  siteLabel: string
  pathLabel: string
  highlightedTitleSegments: BookmarkHighlightSegment[]
  highlightedUrlSegments: BookmarkHighlightSegment[]
  highlightedFolderSegments: BookmarkHighlightSegment[]
  highlightedSiteSegments: BookmarkHighlightSegment[]
  highlightedPathSegments: BookmarkHighlightSegment[]
}

export interface BookmarkCardEntry {
  cardKey: string
  item: BookmarkCardItem
  searchMeta?: BookmarkSearchMeta
}

export interface BookmarkSection {
  key: string
  title: string
  entries: BookmarkCardEntry[]
}
