export interface BookmarkCardItem {
  id: string
  title: string
  url: string
  folderPath: string[]
  sourceRoot: 'bookmark_bar' | 'other' | 'synced'
  dateAdded: string
  isPinned: boolean
  openCount: number
}
