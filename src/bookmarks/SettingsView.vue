<script lang="ts" setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
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

const emit = defineEmits(['back', 'save', 'reset', 'reload'])
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

      <p v-if="error" class="field-error">{{ error }}</p>

      <div class="actions-row">
        <button class="primary-button" :disabled="saving" @click="emitSave">保存并读取</button>
        <button class="secondary-button" :disabled="saving" @click="emit('reset')">恢复默认路径</button>
        <button class="secondary-button" :disabled="saving" @click="emitReload">重新读取</button>
      </div>
    </section>
  </section>
</template>
