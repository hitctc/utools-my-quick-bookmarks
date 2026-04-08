<script lang="ts" setup>
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

// 把目录数组整理成首页可读的层级文案。
function formatFolderPath(folderPath: unknown) {
  if (!Array.isArray(folderPath) || folderPath.length === 0) {
    return '未分类'
  }

  return folderPath.join(' / ')
}
</script>

<template>
  <section class="page-shell">
    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Quick Bookmarks</p>
        <h1>我的快捷书签</h1>
        <p class="hero-text">
          先从 macOS 下的 Google Chrome 默认书签文件开始，把本机书签读出来并核对解析结果。
        </p>
      </div>
      <button class="icon-button" @click="emit('open-settings')">
        设置
      </button>
    </header>

    <section class="summary-card">
      <div>
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
    <section v-else-if="!props.items.length" class="state-card">
      <p>当前没有可展示的书签结果。</p>
    </section>
    <section v-else class="bookmark-grid">
      <article
        v-for="item in props.items"
        :key="`${item.sourceRoot}-${item.id}-${item.url}`"
        class="bookmark-card"
      >
        <p class="bookmark-root">{{ item.sourceRoot }}</p>
        <h2>{{ item.title || '未命名书签' }}</h2>
        <a class="bookmark-link" :href="item.url">{{ item.url }}</a>
        <p class="bookmark-meta">目录：{{ formatFolderPath(item.folderPath) }}</p>
      </article>
    </section>
  </section>
</template>
