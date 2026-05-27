# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
npm install        # 安装依赖
npm test           # 运行单测（node --test tests/preload/*.test.mjs）
npm run dev        # 启动 Vite 开发服务（localhost:5173）
npm run build      # 生产构建，产物输出到 dist/
```

项目无 linter 配置。单测使用 Node 内置 `node:test`，测试文件位于 `tests/preload/`。

## 架构概览

这是一个 uTools 插件，用于在 uTools 内快速搜索和打开 Chrome 书签。技术栈：Vue 3 + Vite 6，仅支持 macOS + Google Chrome Default profile。

### 数据流

```
Chrome Bookmarks JSON
  → public/preload/chromeBookmarks.cjs（路径计算 + JSON 递归解析）
  → public/preload/services.js（桥接 utools.dbStorage、文件读取、缓存、打开 URL）
  → window.services 暴露给渲染层
  → src/App.vue（状态整合、双视图切换、主题、窗口高度）
  → src/bookmarks/HomeView.vue（搜索、卡片展示、键盘导航）
  → src/bookmarks/SettingsView.vue（路径配置、主题、窗口高度、UI 开关）
```

### 关键架构约束

- **preload 层**（`public/preload/`）运行在 Node.js 环境，使用 CommonJS（`public/preload/package.json` 声明了 `"type": "commonjs"`）。所有文件系统、`dbStorage` 等需要 Node 权限的能力必须收口在这里，通过 `window.services` 暴露给前端。
- **渲染层**（`src/`）是 Vue 3 SPA，不使用 vue-router，`App.vue` 内维护 `home / settings` 双视图切换。
- **构建产物**（`dist/`）的 `base` 固定为 `./`，适配 uTools 本地资源加载。
- **状态持久化**全部通过 `utools.dbStorage`（支持 uTools 云同步），仅书签秒开缓存落在本机文件。

### 测试覆盖

单测覆盖 preload 层纯逻辑：书签解析（`chromeBookmarks.test.mjs`）、本地状态规则（`localState.test.mjs`）、主题解析（`theme.test.mjs`）、搜索逻辑（`search.test.mjs`）、键盘导航（`keyboardNavigation.test.mjs`）、排序规则（`itemOrder.test.mjs`）、启动壳子（`bootShell.test.mjs`）。前端 Vue 组件无测试。

## 开发与调试

1. `npm run dev` 启动 Vite 后，在 uTools 开发者工具中选择 `public/plugin.json` 接入开发
2. 改 `src/` 下的前端代码有热更新；改 `preload/` 或 `plugin.json` 后需重新进入插件
3. `npm run build` 后可在 uTools 开发者工具中选择 `dist/plugin.json` 验证构建产物

## 详细文档

项目根目录的 `AGENTS.md` 包含完整的能力清单、目录职责、配置约束、smoke test 清单和维护规则，改动较大时请同步查阅。
