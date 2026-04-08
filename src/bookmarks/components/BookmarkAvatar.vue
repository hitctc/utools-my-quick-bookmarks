<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    url: string
    size?: number
  }>(),
  {
    size: 44,
  },
)

// 头像只取短标识，优先保留可读的两位字母，让面板看起来更像设备标签。
function getDisplayLetter(value: string) {
  const text = value.trim()
  const compact = text.replace(/[^a-z0-9]/gi, '')
  if (compact.length >= 2) {
    return compact.slice(0, 2).toUpperCase()
  }

  return (text[0] || '?').toUpperCase()
}

const hostText = computed(() => {
  try {
    return new URL(props.url).host
  } catch {
    return ''
  }
})

const avatarLetter = computed(() => getDisplayLetter(hostText.value || props.title || props.url || '?'))

const avatarStyle = computed(() => {
  const seed = `${props.url}|${props.title}`
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 1000
  }

  return {
    backgroundColor: `hsl(0, 0%, ${88 - (hash % 6)}%)`,
    border: `1px solid hsl(0, 0%, ${70 - (hash % 5)}%)`,
    color: `hsl(0, 0%, ${18 + (hash % 6)}%)`,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    letterSpacing: '0.08em',
    backgroundImage: 'none',
  }
})
</script>

<template>
  <div
    class="bookmark-avatar"
    :style="[{ width: `${size}px`, height: `${size}px` }, avatarStyle]"
    aria-hidden="true"
  >
    <span class="bookmark-avatar__letter">{{ avatarLetter }}</span>
  </div>
</template>
