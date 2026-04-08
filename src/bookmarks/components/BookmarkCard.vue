<script lang="ts" setup>
import BookmarkCover from './BookmarkCover.vue'
import type { BookmarkCardItem } from '../types'

const props = withDefaults(
  defineProps<{
    item: BookmarkCardItem
    active?: boolean
  }>(),
  {
    active: false,
  },
)

const emit = defineEmits<{
  (event: 'open', url: string): void
  (event: 'toggle-pin', item: BookmarkCardItem): void
}>()

function formatFolderPath(folderPath: string[]) {
  if (!Array.isArray(folderPath) || folderPath.length === 0) {
    return '未分类'
  }

  return folderPath.join(' / ')
}

// 打开动作只负责把 URL 交回上层，避免卡片组件自己绑定具体的打开实现。
function handleOpen() {
  emit('open', props.item.url)
}

// 置顶按钮先保留交互壳，后续接入本地状态时只需要补上父级监听。
function handleTogglePin(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  emit('toggle-pin', props.item)
}
</script>

<template>
  <article class="bookmark-card" :class="{ 'bookmark-card--active': active }">
    <button
      type="button"
      class="bookmark-card__pin"
      :class="{ 'bookmark-card__pin--active': item.isPinned }"
      :title="item.isPinned ? '取消置顶' : '置顶书签'"
      :aria-label="item.isPinned ? '取消置顶' : '置顶书签'"
      @click="handleTogglePin"
    >
      <span class="bookmark-card__pin-icon">⌖</span>
      <span class="bookmark-card__pin-text">{{ item.isPinned ? '已置顶' : '置顶' }}</span>
    </button>

    <button type="button" class="bookmark-card__open" @click="handleOpen">
      <BookmarkCover
        :title="item.title"
        :url="item.url"
        :folder-label="formatFolderPath(item.folderPath)"
        :source-root="item.sourceRoot"
        :open-count="item.openCount"
        :is-pinned="item.isPinned"
        :active="active"
      />
    </button>
  </article>
</template>
