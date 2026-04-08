<script lang="ts" setup>
import BookmarksSection from './components/BookmarksSection.vue'
import BookmarkCard from './components/BookmarkCard.vue'
import type { BookmarkCardItem, BookmarkSection } from './types'

const props = defineProps({
  bookmarkPath: {
    type: String,
    required: true,
  },
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
</script>

<template>
  <section class="page-shell page-shell--home">
    <header class="hero hero--bookmarks">
      <div class="hero-copy">
        <p class="eyebrow">Quick Bookmarks</p>
        <h1>我的快捷书签</h1>
        <p class="hero-text">
          使用 uTools 顶部输入框实时搜索书签标题、网址和目录，卡片支持点击打开与插件内置顶。
        </p>
      </div>
      <button class="icon-button" @click="emit('open-settings')">
        设置
      </button>
    </header>

    <section class="summary-card summary-card--wide">
      <div class="summary-copy">
        <p class="section-label">当前书签文件</p>
        <p class="path-text">{{ bookmarkPath || '尚未确定路径' }}</p>
      </div>
      <div class="summary-pill">
        <span>书签总数</span>
        <strong>{{ total }}</strong>
      </div>
    </section>

    <section v-if="!bootstrapped" class="state-card">
      <p>请通过 uTools 接入开发模式进入插件。</p>
    </section>
    <section v-else-if="loading" class="state-card">
      <p>正在读取 Chrome 书签文件…</p>
    </section>
    <section v-else-if="error" class="state-card state-error">
      <p>{{ error }}</p>
    </section>
    <section v-else-if="!props.sections.length" class="state-card">
      <p>{{ props.emptyText || '当前没有可展示的书签结果。' }}</p>
    </section>
    <template v-else>
      <BookmarksSection
        v-for="section in (props.sections as BookmarkSection[])"
        :key="section.key"
        :title="section.title"
        :description="section.description"
        :count="section.entries.length"
      >
        <div class="bookmark-grid">
          <article
            v-for="entry in section.entries"
            :key="entry.cardKey"
            class="bookmark-grid__item"
          >
            <BookmarkCard
              :item="entry.item"
              :show-open-count="props.showOpenCount"
              :active="entry.cardKey === props.highlightedCardKey"
              @open="emit('open-bookmark', $event)"
              @toggle-pin="emit('toggle-pin', $event)"
            />
          </article>
        </div>
      </BookmarksSection>
    </template>
    <section
      v-if="bootstrapped && !loading && !error"
      class="search-tip-card"
      :class="{ 'search-tip-card--searching': isSearchMode }"
    >
      <p class="search-tip-card__title">
        {{ isSearchMode ? '正在使用顶部输入框筛选书签' : '可以直接在顶部输入框搜索书签' }}
      </p>
      <p class="search-tip-card__copy">
        <template v-if="isSearchMode">
          当前搜索词：<strong>{{ searchQuery }}</strong>。按方向键切换高亮卡片，按回车直接打开。
        </template>
        <template v-else>
          支持模糊匹配标题、URL 和目录路径，不会在页面里额外再放一个搜索框。
        </template>
      </p>
    </section>
  </section>
</template>
