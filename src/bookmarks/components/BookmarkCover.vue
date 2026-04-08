<script lang="ts" setup>
import { computed } from 'vue'
import BookmarkAvatar from './BookmarkAvatar.vue'

const props = defineProps<{
  title: string
  url: string
  folderLabel: string
  sourceRoot: string
  openCount: number
  showOpenCount: boolean
  isPinned: boolean
  active: boolean
}>()

const SOURCE_ROOT_LABELS: Record<string, string> = {
  bookmark_bar: '书签栏',
  other: '其他书签',
  synced: '同步书签',
}

const sourceRootLabel = computed(() => SOURCE_ROOT_LABELS[props.sourceRoot] ?? props.sourceRoot)

const siteLabel = computed(() => {
  try {
    return new URL(props.url).host
  } catch {
    return props.url
  }
})

const coverStyle = computed(() => {
  const seed = `${props.url}|${props.title}|${props.folderLabel}|${props.sourceRoot}`
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 1000
  }

  return {
    backgroundColor: `hsl(0, 0%, ${active ? 92 - (hash % 3) : 95 - (hash % 4)}%)`,
    borderColor: `hsl(0, 0%, ${active ? 76 - (hash % 4) : 84 - (hash % 5)}%)`,
  }
})

const statusLabel = computed(() => (props.isPinned ? '已置顶' : '普通'))
</script>

<template>
  <div class="bookmark-cover" :class="{ 'bookmark-cover--active': active }" :style="coverStyle">
    <div class="bookmark-cover__top">
      <BookmarkAvatar :title="title" :url="url" :size="40" />
      <div class="bookmark-cover__meta">
        <p class="bookmark-cover__root">来源 · {{ sourceRootLabel }}</p>
        <p class="bookmark-cover__site" :title="siteLabel">{{ siteLabel }}</p>
      </div>
    </div>

    <div class="bookmark-cover__body">
      <h3 class="bookmark-cover__title" :title="title">{{ title }}</h3>
      <p class="bookmark-cover__url" :title="url">{{ url }}</p>
    </div>

    <div class="bookmark-cover__footer">
      <span class="bookmark-cover__folder">目录：{{ folderLabel }}</span>
      <div class="bookmark-cover__footer-stats" style="display: flex; align-items: center; gap: 8px;">
        <span v-if="showOpenCount" class="bookmark-cover__count">{{ openCount }} 次</span>
        <span class="bookmark-cover__chip" :class="{ 'bookmark-cover__chip--active': isPinned }">
          {{ statusLabel }}
        </span>
      </div>
    </div>
  </div>
</template>
