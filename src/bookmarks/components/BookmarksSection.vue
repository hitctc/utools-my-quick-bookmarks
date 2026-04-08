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
      <div class="bookmarks-section__headline">
        <p class="bookmarks-section__eyebrow">SECTION / {{ props.title }}</p>
        <h2 class="bookmarks-section__title">{{ props.title }}</h2>
        <p class="bookmarks-section__description">{{ props.description }}</p>
      </div>
      <div class="bookmarks-section__count-badge" aria-label="书签数量">
        <span class="bookmarks-section__count-label">ITEMS</span>
        <strong class="bookmarks-section__count">{{ count }}</strong>
      </div>
    </header>
    <div class="bookmarks-section__body">
      <slot />
    </div>
  </section>
</template>
