<script lang="ts" setup>
import { computed } from 'vue'
import BookmarksSection from './components/BookmarksSection.vue'
import BookmarkCard from './components/BookmarkCard.vue'
import type { BookmarkCardItem } from './types'

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
  items: {
    type: Array,
    required: true,
  },
  total: {
    type: Number,
    required: true,
  },
})

const emit = defineEmits(['open-settings'])

// 首页现在只消费现有字段，把原始书签数据整理成卡片组件需要的稳定结构。
function normalizeItem(item: any): BookmarkCardItem {
  return {
    id: String(item?.id ?? item?.url ?? `${item?.title || 'bookmark'}-${item?.dateAdded || '0'}`),
    title: String(item?.title ?? '').trim() || '未命名书签',
    url: String(item?.url ?? '').trim(),
    folderPath: Array.isArray(item?.folderPath) ? item.folderPath : [],
    sourceRoot: item?.sourceRoot || 'bookmark_bar',
    dateAdded: String(item?.dateAdded ?? ''),
    isPinned: Boolean(item?.isPinned),
    openCount: Number(item?.openCount ?? 0) || 0,
  }
}

const bookmarkGroups = computed(() => {
  const normalized = (props.items as unknown[]).map(normalizeItem)
  const pinned = normalized.filter(item => item.isPinned)
  const regular = normalized.filter(item => !item.isPinned)

  return [
    {
      key: 'pinned',
      title: '置顶',
      description: '优先展示在首页的本地卡片',
      items: pinned,
    },
    {
      key: 'all',
      title: '全部书签',
      description: '从 macOS Chrome Bookmarks 文件解析出的书签',
      items: regular,
    },
  ].filter(group => group.items.length > 0)
})

// 点击卡片时优先走 uTools 的外部打开能力，缺省时回落到浏览器窗口打开。
function handleOpenBookmark(url: string) {
  if (!url) return

  if (window.utools?.shellOpenExternal) {
    window.utools.shellOpenExternal(url)
    return
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <section class="page-shell page-shell--home">
    <header class="hero hero--bookmarks">
      <div class="hero-copy">
        <p class="eyebrow">Quick Bookmarks</p>
        <h1>我的快捷书签</h1>
        <p class="hero-text">
          以卡片方式展示 Chrome 书签内容，保留书签路径、来源与本地状态的视觉入口。
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
    <section v-else-if="!bookmarkGroups.length" class="state-card">
      <p>当前没有可展示的书签结果。</p>
    </section>
    <template v-else>
      <BookmarksSection
        v-for="group in bookmarkGroups"
        :key="group.key"
        :title="group.title"
        :description="group.description"
        :count="group.items.length"
      >
        <div class="bookmark-grid">
          <article
            v-for="item in group.items"
            :key="`${item.sourceRoot}-${item.id}-${item.url}`"
            class="bookmark-grid__item"
          >
            <BookmarkCard
              :item="item"
              :active="false"
              @open="handleOpenBookmark"
            />
          </article>
        </div>
      </BookmarksSection>
    </template>
  </section>
</template>
