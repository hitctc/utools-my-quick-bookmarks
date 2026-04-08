<script lang="ts" setup>
import { computed } from 'vue'
import BookmarkAvatar from './BookmarkAvatar.vue'

const props = defineProps<{
  title: string
  url: string
  folderLabel: string
  sourceRoot: string
  openCount: number
  isPinned: boolean
  active: boolean
}>()

const siteLabel = computed(() => {
  try {
    return new URL(props.url).host
  } catch {
    return props.url
  }
})

const coverStyle = computed(() => {
  const seed = `${props.url}|${props.title}|${props.folderLabel}`
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33 + seed.charCodeAt(index)) % 360
  }

  return {
    backgroundImage: `linear-gradient(145deg, hsl(${hash}, 44%, 94%), hsl(${(hash + 28) % 360}, 52%, 84%))`,
  }
})
</script>

<template>
  <div class="bookmark-cover" :class="{ 'bookmark-cover--active': active }" :style="coverStyle">
    <div class="bookmark-cover__overlay" />

    <div class="bookmark-cover__top">
      <BookmarkAvatar :title="title" :url="url" :size="40" />
      <div class="bookmark-cover__meta">
        <p class="bookmark-cover__root">{{ sourceRoot }}</p>
        <p class="bookmark-cover__site" :title="siteLabel">{{ siteLabel }}</p>
      </div>
    </div>

    <div class="bookmark-cover__body">
      <h3 class="bookmark-cover__title" :title="title">{{ title }}</h3>
      <p class="bookmark-cover__url" :title="url">{{ url }}</p>
      <p class="bookmark-cover__folder">目录：{{ folderLabel }}</p>
    </div>

    <div class="bookmark-cover__footer">
      <span class="bookmark-cover__chip" :class="{ 'bookmark-cover__chip--active': isPinned }">
        {{ isPinned ? '已置顶' : '可置顶' }}
      </span>
      <span v-if="openCount > 0" class="bookmark-cover__count">{{ openCount }}</span>
    </div>
  </div>
</template>
