<script lang="ts" setup>
const props = defineProps<{
  title: string
  description: string
  count: number
}>()
</script>

<template>
  <section class="bookmarks-section">
    <header class="bookmarks-section__header">
      <div class="bookmarks-section__meta">
        <p class="mono-label">{{ props.title }}</p>
        <p class="bookmarks-section__description">{{ props.description }}</p>
      </div>
      <span class="bookmarks-section__count">[ {{ count }} ]</span>
    </header>
    <div class="bookmarks-section__body">
      <slot />
    </div>
  </section>
</template>
