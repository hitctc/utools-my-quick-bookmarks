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

function getDisplayLetter(value: string) {
  const text = value.trim()
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
    hash = (hash * 31 + seed.charCodeAt(index)) % 360
  }

  return {
    backgroundImage: `linear-gradient(135deg, hsl(${hash}, 72%, 55%), hsl(${(hash + 42) % 360}, 68%, 45%))`,
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
