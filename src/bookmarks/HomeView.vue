<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import BookmarksSection from './components/BookmarksSection.vue'
import BookmarkCard from './components/BookmarkCard.vue'
import { normalizeSearchTokens } from './search'
import type { BookmarkCardItem, BookmarkSection } from './types'

const props = defineProps({
  bootstrapped: {
    type: Boolean,
    required: true,
  },
  loading: {
    type: Boolean,
    required: true,
  },
  error: {
    type: String,
    default: '',
  },
  sections: {
    type: Array,
    required: true,
  },
  highlightedCardKey: {
    type: String,
    default: '',
  },
  isSearchMode: {
    type: Boolean,
    required: true,
  },
  searchQuery: {
    type: String,
    default: '',
  },
  emptyText: {
    type: String,
    default: '',
  },
  showOpenCount: {
    type: Boolean,
    required: true,
  },
  themeStatus: {
    type: String,
    required: true,
  },
  total: {
    type: Number,
    required: true,
  },
})

const emit = defineEmits<{
  (event: 'open-settings'): void
  (event: 'open-bookmark', item: BookmarkCardItem): void
  (event: 'toggle-pin', item: BookmarkCardItem): void
}>()

const homeContentRef = ref<HTMLElement | null>(null)

// 搜索词在首页本地归一化，避免为了高亮能力再改动上层状态流。
const searchTokens = computed(() => normalizeSearchTokens(props.searchQuery))
const sectionsSignature = computed(() =>
  (props.sections as BookmarkSection[])
    .map(section => `${section.key}:${section.entries.map(entry => entry.cardKey).join(',')}`)
    .join('|'),
)

// 键盘高亮项变化后，把对应卡片滚动到当前可视区域内。
async function scrollHighlightedCardIntoView(cardKey: string) {
  if (!cardKey) {
    return
  }

  await nextTick()

  const cardElement = Array.from(
    homeContentRef.value?.querySelectorAll<HTMLElement>('[data-card-key]') ?? [],
  ).find(element => element.dataset.cardKey === cardKey)

  cardElement?.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
  })
}

watch(
  [() => props.highlightedCardKey, sectionsSignature],
  ([cardKey]) => {
    void scrollHighlightedCardIntoView(cardKey)
  },
)

onMounted(() => {
  void scrollHighlightedCardIntoView(props.highlightedCardKey)
})
</script>

<template>
  <section class="page-shell page-shell--home">
    <button
      type="button"
      class="icon-button icon-button--settings page-shell__settings floating-action-button"
      aria-label="打开设置"
      title="设置"
      @click="emit('open-settings')"
    >
      <span class="icon-button__glyph" aria-hidden="true">+</span>
    </button>

    <header class="hero hero--compact hero--status-bar">
      <div class="hero__status-row">
        <span class="status-chip">书签 {{ total }}</span>
        <span class="status-chip status-chip--muted">{{ themeStatus }}</span>
        <span v-if="isSearchMode" class="status-chip status-chip--muted">搜索中</span>
      </div>
    </header>

    <section v-if="!bootstrapped" class="state-card" ref="homeContentRef">
      <p>请通过 uTools 接入开发模式进入插件。</p>
    </section>
    <section v-else-if="loading" class="state-card" ref="homeContentRef">
      <p>正在读取 Chrome 书签文件…</p>
    </section>
    <section v-else-if="error" class="state-card state-error" ref="homeContentRef">
      <p>{{ error }}</p>
    </section>
    <section v-else-if="!props.sections.length" class="state-card" ref="homeContentRef">
      <p>{{ props.emptyText || '当前没有可展示的书签结果。' }}</p>
    </section>
    <div v-else ref="homeContentRef">
      <BookmarksSection
        v-for="section in (props.sections as BookmarkSection[])"
        :key="section.key"
        :title="section.title"
        :count="section.entries.length"
      >
        <div class="bookmark-grid">
          <article
            v-for="entry in section.entries"
            :key="entry.cardKey"
            class="bookmark-grid__item"
            :data-card-key="entry.cardKey"
          >
            <BookmarkCard
              :item="entry.item"
              :show-open-count="props.showOpenCount"
              :active="entry.cardKey === props.highlightedCardKey"
              :search-tokens="searchTokens"
              @open="emit('open-bookmark', $event)"
              @toggle-pin="emit('toggle-pin', $event)"
            />
          </article>
        </div>
      </BookmarksSection>
    </div>
    <section
      v-if="bootstrapped && !loading && !error"
      class="state-strip"
    >
      <p class="state-strip__label">[ 操作提示 ]</p>
      <p class="state-strip__copy">
        上下键选择，回车打开；多个关键词用空格分开
      </p>
    </section>
  </section>
</template>
