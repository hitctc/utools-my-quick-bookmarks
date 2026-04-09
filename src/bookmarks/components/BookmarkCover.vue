<script lang="ts" setup>
import { computed } from 'vue'

const props = defineProps<{
  title: string
  siteLabel: string
  pathLabel: string
  openCount: number
  showOpenCount: boolean
  active: boolean
  urlOnlyMatch: boolean
  titleSegments: Array<{ text: string; matched: boolean }>
  siteSegments: Array<{ text: string; matched: boolean }>
  pathSegments: Array<{ text: string; matched: boolean }>
}>()
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
const stablePathSegments = computed(() => getStableSegments(props.pathSegments, props.pathLabel))
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
      <span class="bookmark-cover__path" :title="pathLabel">
        <span class="bookmark-cover__path-label">路径</span>
        <span class="bookmark-cover__path-value">
          <template v-for="(segment, index) in stablePathSegments" :key="`path-${index}`">
            <mark v-if="segment.matched" class="bookmark-cover__highlight">{{ segment.text }}</mark>
            <span v-else>{{ segment.text }}</span>
          </template>
        </span>
      </span>
      <div class="bookmark-cover__footer-stats">
        <span v-if="urlOnlyMatch" class="bookmark-cover__chip">网址命中</span>
        <span v-if="showOpenCount && openCount > 0" class="bookmark-cover__count">{{ openCountLabel }}</span>
      </div>
    </div>
  </div>
</template>
