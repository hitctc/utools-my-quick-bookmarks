<script lang="ts" setup>
import { computed } from 'vue'

const props = defineProps<{
  title: string
  siteLabel: string
  folderLabel: string
  openCount: number
  showOpenCount: boolean
  isPinned: boolean
  active: boolean
  urlOnlyMatch: boolean
  titleSegments: Array<{ text: string; matched: boolean }>
  siteSegments: Array<{ text: string; matched: boolean }>
  folderSegments: Array<{ text: string; matched: boolean }>
}>()
const pinLabel = computed(() => (props.isPinned ? '已置顶' : '未置顶'))
const openCountLabel = computed(() => `打开 ${props.openCount} 次`)

// 片段数据可能来自空字符串，这里统一兜底，保证模板渲染结构稳定。
function getStableSegments(segments: Array<{ text: string; matched: boolean }>, fallbackText: string) {
  if (Array.isArray(segments) && segments.length > 0) {
    return segments
  }

  return [{ text: fallbackText, matched: false }]
}

const stableTitleSegments = computed(() => getStableSegments(props.titleSegments, props.title))
const stableSiteSegments = computed(() => getStableSegments(props.siteSegments, props.siteLabel))
const stableFolderSegments = computed(() => getStableSegments(props.folderSegments, props.folderLabel))
</script>

<template>
  <div class="bookmark-cover" :class="{ 'bookmark-cover--active': active }">
    <div class="bookmark-cover__meta-row">
      <p class="bookmark-cover__site" :title="siteLabel">
        <template v-for="(segment, index) in stableSiteSegments" :key="`site-${index}`">
          <mark v-if="segment.matched" class="bookmark-cover__highlight">{{ segment.text }}</mark>
          <span v-else>{{ segment.text }}</span>
        </template>
      </p>
      <div class="bookmark-cover__chips">
        <span
          class="bookmark-cover__chip"
          :class="{ 'bookmark-cover__chip--active': isPinned }"
        >
          {{ pinLabel }}
        </span>
        <span v-if="urlOnlyMatch" class="bookmark-cover__chip">网址命中</span>
      </div>
    </div>

    <div class="bookmark-cover__body bookmark-cover__body--compact">
      <h3 class="bookmark-cover__title" :title="title">
        <template v-for="(segment, index) in stableTitleSegments" :key="`title-${index}`">
          <mark v-if="segment.matched" class="bookmark-cover__highlight">{{ segment.text }}</mark>
          <span v-else>{{ segment.text }}</span>
        </template>
      </h3>
    </div>

    <div class="bookmark-cover__footer">
      <span class="bookmark-cover__folder" :title="folderLabel">
        <span class="bookmark-cover__folder-label">目录</span>
        <span class="bookmark-cover__folder-value">
          <template v-for="(segment, index) in stableFolderSegments" :key="`folder-${index}`">
            <mark v-if="segment.matched" class="bookmark-cover__highlight">{{ segment.text }}</mark>
            <span v-else>{{ segment.text }}</span>
          </template>
        </span>
      </span>
      <div class="bookmark-cover__footer-stats">
        <span v-if="showOpenCount && openCount > 0" class="bookmark-cover__count">{{ openCountLabel }}</span>
      </div>
    </div>
  </div>
</template>
