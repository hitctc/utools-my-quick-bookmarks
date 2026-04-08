# Chrome 书签路径配置与解析设计

## 1. 背景

当前仓库仍停留在 uTools 官方模板阶段，还没有任何真实的书签业务能力。

本轮目标不是一次性做完整的“快捷书签工具”，而是先完成第一步：

- 在 macOS 上默认定位 `Google Chrome` 的书签文件
- 允许用户在应用内修改书签文件路径
- 正确读取并解析 Chrome `Bookmarks` JSON 文件
- 把解析结果以可检查的方式展示在首页

这一步完成后，后续才能继续做搜索、过滤、打开网址、多浏览器支持和多 profile 适配。

## 2. 输入与约束

### 2.1 用户要求

- 先只支持 `macOS + Google Chrome`
- 首页右上角增加一个设置按钮
- 点击设置按钮进入配置书签文件路径的功能
- 默认帮用户填好 Chrome 的默认书签文件路径
- 允许用户修改这个路径
- 当前阶段重点是“拿到书签文件并正确解析数据”

### 2.2 参考来源

- uTools 官方文档：
  - `preload` 用于向渲染进程暴露 Node.js 能力
  - `utools.dbStorage` 适合保存插件本地轻量配置
- 参考项目：`LanyuanXiaoyao-Studio/utools-recent-projects`
  - Chromium 浏览器书签路径默认定位到 `~/Library/Application Support/Google/Chrome/Default/Bookmarks`
  - 解析 `roots.bookmark_bar`、`roots.other`、`roots.synced` 三棵树，并递归展开文件夹层级

### 2.3 本轮明确不做

- 不支持 Windows / Linux
- 不支持 Edge / Brave / Chromium / Safari
- 不支持多个 Chrome profile 的自动探测与切换
- 不支持书签搜索、排序、收藏、标签和打开网址动作
- 不引入 `vue-router`、状态管理库、自动化测试框架

## 3. 方案选择

本轮采用“首页 + 设置页”的轻量双视图方案，而不是弹层方案。

原因：

- 需要承载路径编辑、保存、重置默认路径、重载解析、错误提示，弹层很快会变得拥挤。
- 后续如果扩成“浏览器类型 + profile + 最近加载状态 + 权限/路径检测”，设置页结构更稳。
- 当前项目还没有真实业务 UI，直接在 `App.vue` 内做轻量双视图切换已经够用，不必上路由。

## 4. 默认路径策略

### 4.1 默认路径

在 macOS 下默认使用：

`~/Library/Application Support/Google/Chrome/Default/Bookmarks`

落地实现时，`~` 会展开成当前用户 home 目录的绝对路径。

### 4.2 用户可修改路径

- 插件首次运行时，如果本地没有保存过配置，就使用默认路径
- 用户在设置页保存后，后续优先使用用户保存的路径
- 设置页提供“恢复默认路径”能力

### 4.3 多 Chrome / 多 profile 风险

当前只先支持默认 profile 的 `Default/Bookmarks`，这是一个已知限制。

风险：

- 用户常用的 Chrome 可能不是这个 profile
- 用户可能使用 Chrome Beta、Chrome Canary，或者企业版 Chrome
- 用户也可能长期使用 Brave / Edge，但界面上看到的是 Chrome 默认路径

处理方式：

- 第一阶段不自动扫描多个浏览器实例
- 通过设置页允许用户手工修改路径
- 首页或设置页文案明确提示：默认路径仅针对 macOS 下的 Google Chrome 默认 profile

## 5. 数据模型

前端只消费结构化后的书签数据，不直接解析原始 JSON。

### 5.1 配置模型

```ts
interface BookmarkSettings {
  chromeBookmarksPath: string
}
```

### 5.2 书签节点模型

```ts
interface ParsedBookmarkItem {
  id: string
  title: string
  url: string
  folderPath: string[]
  sourceRoot: 'bookmark_bar' | 'other' | 'synced'
  dateAdded: string
}
```

### 5.3 解析结果模型

```ts
interface BookmarkLoadResult {
  filePath: string
  total: number
  items: ParsedBookmarkItem[]
}
```

## 6. 模块设计

### 6.1 `public/preload/services.js`

新增或扩展以下职责：

- 生成 macOS Chrome 默认书签文件路径
- 读取本地持久化的路径配置
- 保存用户修改后的路径配置
- 恢复默认路径
- 读取并解析 `Bookmarks` 文件

前端通过 `window.services` 调用这些能力。

### 6.2 `src/App.vue`

从模板式“按 feature code 切换组件”改成当前插件内的主入口页面，负责：

- 维护当前视图：`home` / `settings`
- 首次进入插件时初始化配置与书签数据加载
- 从设置页返回首页后重新触发解析
- 管理加载态、错误态和成功态

### 6.3 首页组件

首页负责展示：

- 标题
- 右上角设置按钮
- 当前使用中的书签文件路径摘要
- 当前解析状态
- 解析出的书签列表

首页先做“可核对数据”的展示，不追求复杂交互。

### 6.4 设置组件

设置页负责：

- 展示当前路径
- 编辑路径
- 保存路径
- 恢复默认路径
- 手动触发一次重新加载
- 返回首页

## 7. 数据流

### 7.1 首次进入插件

1. `App.vue` 初始化
2. 调用 `window.services.getBookmarkSettings()`
3. 如果没有用户配置，则生成默认路径
4. 调用 `window.services.loadChromeBookmarks(path)`
5. 成功则展示书签列表；失败则展示错误态

### 7.2 用户进入设置页

1. 首页点击右上角设置按钮
2. 切换到设置页
3. 设置页显示当前路径

### 7.3 用户保存新路径

1. 输入新路径
2. 点击保存
3. 调用 `window.services.saveBookmarkSettings(path)`
4. 保存成功后立即调用 `window.services.loadChromeBookmarks(path)`
5. 成功则回首页并刷新结果；失败则保留在设置页显示错误

## 8. 解析策略

### 8.1 输入来源

Chrome 的 `Bookmarks` 文件本质上是 JSON。

本轮只解析：

- `roots.bookmark_bar.children`
- `roots.other.children`
- `roots.synced.children`

### 8.2 递归展开规则

- `type === 'folder'`：继续递归它的 `children`
- `type === 'url'`：输出为叶子书签项

在递归过程中，需要把父级文件夹名称累积成 `folderPath`。

### 8.3 结果筛选

- 只保留有效 `url` 节点
- 跳过没有 `url` 的目录节点
- 标题为空时允许保留，但前端展示时做空标题兜底

### 8.4 时间字段

Chrome `date_added` 保留原始字符串，同时在前端阶段可先不做人类可读格式化。

这样可以减少当前阶段无关复杂度，后续需要排序或展示时间时再格式化。

## 9. 错误处理

### 9.1 路径不存在

- 明确提示“当前路径不存在或不可访问”
- 不静默回退到其他路径

### 9.2 文件不是有效 JSON

- 明确提示“书签文件不是有效的 Chrome Bookmarks JSON”

### 9.3 JSON 结构合法但没有解析出书签

- 明确提示“已读取文件，但没有解析出任何书签”

### 9.4 保存路径后立即解析失败

- 不自动关闭设置页
- 保留用户输入
- 在设置页直接展示失败原因，方便继续改路径

## 10. 界面设计

### 10.1 首页

- 顶部显示应用名
- 右上角固定放一个设置按钮
- 主内容区按状态显示：
  - 加载中
  - 错误提示
  - 解析成功后的书签列表

每个书签列表项至少展示：

- 标题
- URL
- 文件夹路径
- 所属 root

### 10.2 设置页

- 顶部返回按钮
- 标题：`Chrome 书签文件设置`
- 路径输入框
- `保存`
- `恢复默认路径`
- `重新读取`

文案需要明确：

- 当前默认值只适配 macOS 的 Google Chrome 默认 profile
- 如果用户常用的不是默认 profile，需要手动修改路径

## 11. 验证方案

本轮先做最相关验证，不扩成全量测试体系。

### 11.1 代码级验证

- `npm run build`

### 11.2 手动验证

1. 在 macOS 上启动 `npm run dev`
2. 用 uTools 接入 `public/plugin.json`
3. 进入插件首页
4. 确认首页自动尝试读取默认路径
5. 点击右上角设置按钮，确认进入设置页
6. 确认设置页已默认填入 Chrome 默认路径
7. 保存默认路径，确认能返回首页并展示解析结果
8. 故意改成错误路径，确认设置页显示错误且不崩溃
9. 恢复默认路径，再次确认能正常解析

## 12. 实施边界

这轮只追求两件事：

- 能稳定拿到用户本机的 Chrome 书签文件
- 能把书签 JSON 正确解析成前端可消费的数据

只要这两件事成立，本轮就算完成。搜索、打开网址、多浏览器、自动扫描 profile 都留到后续阶段。
