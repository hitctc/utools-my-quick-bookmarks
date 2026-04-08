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
  themeMode: {
    type: String,
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
</script>

<template>
  <section class="page-shell page-shell--home">
    <header class="hero hero--nothing">
      <div class="hero__lead">
        <p class="mono-label">QUICK BOOKMARKS</p>
        <div class="hero__metric">
          <strong class="hero__number">{{ total }}</strong>
          <div class="hero__copy">
            <h1>我的快捷书签</h1>
            <p class="hero__text">
              使用 uTools 顶部输入框搜索、切换高亮并直接打开书签。
            </p>
          </div>
        </div>
      </div>

      <div class="hero__side">
        <div class="hero__status-row">
          <span class="status-chip">[ {{ themeStatus }} ]</span>
          <span class="status-chip status-chip--muted">MODE {{ themeMode.toUpperCase() }}</span>
        </div>
        <p class="hero__path-label">BOOKMARK FILE</p>
        <p class="hero__path" :title="bookmarkPath">{{ bookmarkPath || '尚未确定路径' }}</p>
        <button class="technical-button" @click="emit('open-settings')">
          SETTINGS
        </button>
      </div>
    </header>

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
      class="state-strip"
      :class="{ 'state-strip--active': isSearchMode }"
    >
      <p class="state-strip__label">{{ isSearchMode ? '[ FILTERING ]' : '[ SEARCH READY ]' }}</p>
      <p class="state-strip__copy">
        <template v-if="isSearchMode">
          当前搜索词：<strong>{{ searchQuery }}</strong>，按方向键切换高亮，按回车打开。
        </template>
        <template v-else>
          支持模糊匹配标题、URL 和目录路径，不在页面内额外提供搜索框。
        </template>
      </p>
    </section>
  </section>
</template>
