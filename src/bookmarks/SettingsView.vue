<script lang="ts" setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  themeMode: {
    type: String,
    required: true,
  },
  showRecentOpened: {
    type: Boolean,
    required: true,
  },
  showOpenCount: {
    type: Boolean,
    required: true,
  },
  saving: {
    type: Boolean,
    required: true,
  },
  error: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['back', 'save', 'reset', 'reload', 'change-ui-settings'])
const localPath = ref(props.modelValue)
watch(
  () => props.modelValue,
  value => {
    localPath.value = value
  },
)

// 设置页始终以本地输入框内容为准，避免用户编辑中被外部状态打断。
function emitSave() {
  emit('save', localPath.value)
}

// 允许用户用当前输入路径直接试读，不必先保存。
function emitReload() {
  emit('reload', localPath.value)
}

// 设置页的展示开关即时生效，不要求用户额外点保存按钮。
function emitUiSettingChange(key: 'showRecentOpened' | 'showOpenCount', checked: boolean) {
  emit('change-ui-settings', { [key]: checked })
}

// 主题模式只负责当前选项切换，不改动其他设置字段。
function emitThemeModeChange(themeMode: 'system' | 'dark' | 'light') {
  emit('change-ui-settings', { themeMode })
}
</script>

<template>
  <section class="page-shell">
    <header class="settings-header">
      <button
        type="button"
        class="icon-button icon-button--back"
        aria-label="返回首页"
        title="返回首页"
        @click="emit('back')"
      >
        <span class="icon-button__glyph" aria-hidden="true">←</span>
        <span class="icon-button__label">首页</span>
      </button>
      <p class="section-label">设置</p>
    </header>

    <section class="settings-card">
      <h1>Chrome 书签文件</h1>
      <p class="settings-copy">当前只支持 macOS 下的 Google Chrome 默认 profile。</p>
      <p class="settings-copy">
        首页直接展示书签结果；搜索请使用 uTools 顶部输入框，多个关键词用空格分开。
      </p>
      <p class="settings-copy">
        如果你使用的不是 Default profile，请把路径改成对应的 Bookmarks 文件后再保存或刷新。
      </p>

      <label class="field-label" for="bookmark-path">书签文件路径</label>
      <input
        id="bookmark-path"
        v-model="localPath"
        class="path-input"
        type="text"
        placeholder="/Users/你的用户名/Library/Application Support/Google/Chrome/Default/Bookmarks"
      />

      <p v-if="error" class="field-error">错误：{{ error }}</p>

      <div class="settings-panel">
        <p class="mono-label">主题</p>
        <div class="segmented-control" role="tablist" aria-label="主题模式">
          <button
            type="button"
            class="segmented-control__button"
            :class="{ 'segmented-control__button--active': themeMode === 'system' }"
            @click="emitThemeModeChange('system')"
          >
            跟随系统
          </button>
          <button
            type="button"
            class="segmented-control__button"
            :class="{ 'segmented-control__button--active': themeMode === 'dark' }"
            @click="emitThemeModeChange('dark')"
          >
            深色
          </button>
          <button
            type="button"
            class="segmented-control__button"
            :class="{ 'segmented-control__button--active': themeMode === 'light' }"
            @click="emitThemeModeChange('light')"
          >
            浅色
          </button>
        </div>
      </div>

      <div class="settings-toggle-list">
        <label class="settings-toggle">
          <span>
            <strong>首页显示最近打开</strong>
            <small>打开后会在首页展示最近打开过的书签分区。</small>
          </span>
          <input
            :checked="showRecentOpened"
            class="settings-toggle__input"
            type="checkbox"
            @change="emitUiSettingChange('showRecentOpened', ($event.target as HTMLInputElement).checked)"
          />
        </label>

        <label class="settings-toggle">
          <span>
            <strong>显示打开次数</strong>
            <small>打开后会在书签卡片右下角显示累计打开次数。</small>
          </span>
          <input
            :checked="showOpenCount"
            class="settings-toggle__input"
            type="checkbox"
            @change="emitUiSettingChange('showOpenCount', ($event.target as HTMLInputElement).checked)"
          />
        </label>
      </div>

      <div class="actions-row">
        <button class="primary-button" :disabled="saving" @click="emitSave">保存并读取</button>
        <button class="secondary-button" :disabled="saving" @click="emit('reset')">恢复默认路径</button>
        <button class="secondary-button" :disabled="saving" @click="emitReload">按当前路径刷新</button>
      </div>
    </section>
  </section>
</template>
