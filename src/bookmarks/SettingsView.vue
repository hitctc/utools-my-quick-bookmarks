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
const themeOptions = [
  { value: 'system', label: 'SYSTEM' },
  { value: 'dark', label: 'DARK' },
  { value: 'light', label: 'LIGHT' },
]

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
function emitThemeModeChange(themeMode: string) {
  emit('change-ui-settings', { themeMode })
}
</script>

<template>
  <section class="page-shell">
    <header class="settings-header">
      <button class="text-button" @click="emit('back')">返回首页</button>
      <p class="section-label">Settings</p>
    </header>

    <section class="settings-card">
      <h1>Chrome 书签文件设置</h1>
      <p class="settings-copy">
        当前默认值只适配 macOS 下的 Google Chrome 默认 profile。如果你常用的不是默认 profile，需要手动修改路径。
      </p>

      <label class="field-label" for="bookmark-path">书签文件路径</label>
      <input
        id="bookmark-path"
        v-model="localPath"
        class="path-input"
        type="text"
        placeholder="/Users/你的用户名/Library/Application Support/Google/Chrome/Default/Bookmarks"
      />

      <p v-if="error" class="field-error">[ ERROR: {{ error }} ]</p>

      <div class="settings-theme-panel" aria-label="主题模式设置">
        <p class="field-label">主题模式</p>
        <div class="settings-theme-segmented">
          <label
            v-for="option in themeOptions"
            :key="option.value"
            class="settings-theme-segmented__item"
          >
            <input
              :checked="themeMode === option.value"
              name="theme-mode"
              type="radio"
              :value="option.value"
              @change="emitThemeModeChange(option.value)"
            />
            <span>{{ option.label }}</span>
          </label>
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
        <button class="secondary-button" :disabled="saving" @click="emitReload">刷新书签</button>
      </div>
    </section>
  </section>
</template>
