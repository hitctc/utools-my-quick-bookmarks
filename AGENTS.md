# utools-my-quick-bookmarks 协作文档

## 1. 文档目标

这份 `AGENTS.md` 用来约束本项目内的协作方式，优先级高于上层那些不够贴近本仓库现状的通用规则。

它主要解决四件事：

- 让进入仓库的协作者先快速知道这个项目现在做到哪一步、怎么运行、主要代码在哪。
- 让后续改动优先沿着当前书签 MVP 结构继续推进，而不是回退成模板式试验代码。
- 让协作者明确当前已实现能力、当前限制和下一步边界，避免把未来目标误当成现状。
- 让 `AGENTS.md` 跟着代码一起维护，不变成过期说明。

官方开发文档入口：

- 快速开始：[`https://www.u-tools.cn/docs/developer/basic/getting-started.html`](https://www.u-tools.cn/docs/developer/basic/getting-started.html)
- 文档中心：[`https://www.u-tools.cn/docs/developer/welcome.html`](https://www.u-tools.cn/docs/developer/welcome.html)
- 基础 / API 索引：[`https://www.u-tools.cn/docs/developer/docs.html`](https://www.u-tools.cn/docs/developer/docs.html)
- `dbStorage`：[`https://www.u-tools.cn/docs/developer/api-reference/db/db-storage.html`](https://www.u-tools.cn/docs/developer/api-reference/db/db-storage.html)
- `setSubInput`：[`https://www.u-tools.cn/docs/developer/api-reference/utools/window.html`](https://www.u-tools.cn/docs/developer/api-reference/utools/window.html)
- `shellOpenExternal`：[`https://www.u-tools.cn/docs/developer/utools-api/system.html`](https://www.u-tools.cn/docs/developer/utools-api/system.html)

后续凡是涉及 `uTools API`、`plugin.json`、`preload`、接入开发、打包、发布、部署配置、启动方式等问题，优先查官方开发文档，不凭记忆臆断。

## 2. 项目当前定位

- 项目名称：`utools-my-quick-bookmarks`
- 目标方向：做成一个在 `uTools` 内快速展示、搜索、查看、打开书签的工具
- 当前阶段：Chrome 书签读取、卡片展示与插件内状态 MVP 阶段
- 当前真实能力：
  - 在 macOS 下默认定位 `Google Chrome` 的 `Default/Bookmarks`
  - 允许用户在设置页修改书签文件路径
  - 通过 `preload` 读取并解析 Chrome `Bookmarks` JSON
  - 在首页以卡片形式展示解析后的书签
  - 通过 uTools 顶部输入框实时搜索标题、URL 和目录路径
  - 支持方向键切换高亮项、回车打开书签、点击卡片打开书签
  - 支持插件内置顶、最近打开、打开次数
  - 支持在设置页切换“首页显示最近打开”“显示打开次数”
- 当前明确限制：
  - 只支持 `macOS + Google Chrome`
  - 默认路径只适配 `Default` profile
  - 置顶、最近打开和打开次数只保存在插件本地，不回写 Chrome 原书签文件
  - 不支持在插件里修改书签名称、地址、位置，也不做重复书签检查
- 当前技术栈：`Vue 3 + Vite 6 + @vitejs/plugin-vue + utools-api-types + Node built-in node:test`
- 当前运行模型：
  - `uTools` 进入插件后触发 `src/App.vue` 初始化
  - `public/preload/services.js` 通过 `window.services` 暴露本地配置与书签读取能力
  - `public/preload/chromeBookmarks.cjs` 负责默认路径和书签 JSON 解析
  - `src/bookmarks/*` 负责首页和设置页 UI

当前仓库虽然叫“quick bookmarks”，但目前还只是“读取与展示 Chrome 书签”的第一步，不要把 README 的长期目标描述误当成已交付功能。

## 3. 关键目录与职责

- `public/plugin.json`
  uTools 插件清单文件，定义插件入口、`preload` 路径、开发态地址和功能指令匹配规则。当前只保留一个 `bookmarks` 入口。
- `public/preload/package.json`
  固定 `preload` 目录使用 `commonjs`，不要在这里随意切成 ESM。
- `public/preload/chromeBookmarks.cjs`
  负责默认 Chrome 书签文件路径计算、用户路径决策和 `Bookmarks` JSON 的递归解析。
- `public/preload/services.js`
  负责桥接 `utools.dbStorage`、本地文件读取、打开外部 URL 和错误整理，并通过 `window.services` 暴露给前端。
- `public/preload/localState.cjs`
  负责插件内 UI 设置、置顶映射、最近打开记录和打开次数的归一化规则。
- `src/App.vue`
  当前插件 UI 总入口，负责首页 / 设置页双视图切换、uTools 顶部输入搜索、高亮索引和本地状态整合。
- `src/bookmarks/HomeView.vue`
  首页视图，展示当前路径、读取状态、搜索提示和书签卡片分区。
- `src/bookmarks/SettingsView.vue`
  设置页视图，负责修改路径、恢复默认路径、刷新书签和 UI 开关。
- `src/bookmarks/components/*`
  首页书签卡片、封面、头像和区块容器组件。
- `src/bookmarks/types.ts`
  首页卡片、区块、本地状态相关的前端类型定义。
- `src/main.js`
  Vue 客户端挂载入口。
- `src/main.css`
  当前书签工具 UI 的基础样式。
- `tests/preload/chromeBookmarks.test.mjs`
  负责默认路径和书签 JSON 解析的最小单测。
- `tests/preload/localState.test.mjs`
  负责 UI 开关、置顶、最近打开、打开次数和排序规则的最小单测。
- `vite.config.js`
  Vite 构建配置；当前 `base` 固定为 `./`，用于适配 uTools 本地资源加载。
- `dist/`
  构建产物目录；`npm run build` 后会生成 `dist/index.html`、`dist/plugin.json`、`dist/preload/*` 和静态资源，供 uTools 实际加载。
- `docs/superpowers/specs/`
  保存本轮功能的设计稿。
- `docs/superpowers/plans/`
  保存本轮功能的实现计划。

`src/Hello`、`src/Read`、`src/Write` 仍作为历史模板文件留在仓库里，但当前功能不再使用。后续如果继续推进业务实现，应择机清理，不要再往这些模板组件里加新能力。

## 4. 当前能力与入口约定

当前插件能力全部由 `public/plugin.json` 中的 `features` 决定，并且必须和 `src/App.vue` 的初始化逻辑保持同步。

当前已定义的 feature：

- `bookmarks`
  通过 `书签`、`快捷书签`、`chrome书签` 进入插件，展示 Chrome 书签首页。

当前关键约定：

- 如果新增或重命名 `feature.code`，必须同步更新：
  - `public/plugin.json`
  - `src/App.vue`
  - 对应前端视图或业务模块
  - `README.md` 与 `AGENTS.md`
- 所有需要 Node.js 权限的能力，优先放到 `public/preload/`，再通过 `window.services` 给前端使用；不要把文件系统能力直接散落到渲染层各处。
- 当前 UI 不使用 `vue-router`，而是在 `App.vue` 内维护 `home / settings` 双视图。除非需求明显升级，否则不要提前引入完整路由系统。
- 当前书签数据已经做到“读取 + 解析 + 卡片展示 + 顶部输入搜索 + 插件内状态”；如果继续加多浏览器探测或任何写回 Chrome 的能力，要同步更新本文档里的阶段定义和已知限制。

## 5. 运行与验证

首次进入仓库先确认依赖状态。当前工作区可能没有安装依赖，不要默认 `node_modules` 已存在。

常用命令：

- 安装依赖：`npm install`
- 单测：`npm test`
- 本地开发：`npm run dev`
- 生产构建：`npm run build`

当前开发方式约定：

- `npm run dev` 会启动 Vite 开发服务
- `public/plugin.json` 的 `development.main` 会指向当前本地 Vite 地址
- 用 uTools 开发者工具接入开发时，应选择仓库内的 `public/plugin.json`
- `public/preload/services.js` 或 `public/plugin.json` 变更后，不要只依赖热更新；按官方调试文档重新进入插件，必要时开启“退出到后台立即结束运行”

当前项目的开发 / 预览 / 调试方式：

1. 首次安装依赖：`npm install`
2. 运行单测：`npm test`
3. 启动前端开发服务：`npm run dev`
4. 打开 `uTools 开发者工具`，在项目里选择本仓库的 `public/plugin.json`
5. 点击 `接入开发`
6. 在 uTools 中通过 `书签`、`快捷书签` 或 `chrome书签` 打开插件
7. 改 `src/` 下的前端代码时，Vite 会热更新，回到插件窗口即可看到界面变化
8. 需要看控制台、报错、网络请求或 DOM 时，进入插件后打开 `开发者工具`
9. 进入插件后直接使用 uTools 顶部输入框搜索，不要再去找页面内搜索框
10. 按方向键切换高亮卡片，按回车确认当前高亮项是否能直接打开

当前项目的构建预览方式：

1. 运行 `npm run build`
2. 确认产物已经生成到 `dist/`
3. 在 uTools 开发者工具中选择构建后的 `dist/plugin.json` 对应产物进行验证

文档优先级约定：

- 查“怎么接入开发、怎么调试、热更新为何不生效”，优先看官方“快速开始 / 第一个插件应用 / 调试插件应用”
- 查 `window.utools` 能力、生命周期、数据存储、动态指令等，优先看官方 API 文档
- 查 `plugin.json` 字段语义，优先看官方 `plugin.json 核心配置文件说明`
- 查 `preload` 能力边界和 Node.js 接入方式，优先看官方 `preload` 文档

当前推荐验证顺序：

1. 只改文档或注释时，先做文档自检，确认说明与真实代码一致。
2. 改了书签路径或 JSON 解析逻辑时，先跑 `npm test`。
3. 改了前端界面、插件入口、`plugin.json`、`preload` 或构建配置时，至少跑一次 `npm run build`。
4. 改了 `feature` 匹配、uTools 生命周期或文件读写能力时，跑完 `npm test` 和 `npm run build` 后，再做一次手动 uTools smoke test。

当前推荐 smoke test：

1. 运行 `npm test`
2. 运行 `npm run build`
3. 运行 `npm run dev`
4. 在 uTools 开发者工具中接入 `public/plugin.json`
5. 通过 `书签`、`快捷书签` 或 `chrome书签` 进入插件
6. 确认首页能显示当前书签文件路径和右上角设置按钮
7. 点击设置按钮，确认进入设置页且默认填入 Chrome 默认路径
8. 使用默认路径保存并读取，确认首页能展示解析结果
9. 在顶部输入框输入关键字，确认首页卡片会实时筛选
10. 按方向键移动高亮项，按回车确认书签可打开
11. 点击卡片右上角置顶按钮，确认卡片会进入“置顶”区块
12. 打开几个书签后回到首页，确认“最近打开”和“打开次数”表现符合设置项
13. 故意改成错误路径，确认设置页原地显示错误
14. 点击“恢复默认路径”，确认可回到默认路径

## 6. 配置与安全约束

- 当前项目没有业务环境变量需求；如果后续引入配置，优先明确哪些是非敏感配置、哪些必须走环境变量。
- 不要把 secrets、tokens、cookies、授权码、私有路径或测试账号写进仓库。
- 当前 `preload` 具备 Node.js 文件系统能力；新增能力时优先控制边界，不要默认把过多系统权限直接暴露给前端。
- 路径配置只通过 `utools.dbStorage` 保存，避免额外落地本地明文配置文件。
- 除非需求明确变化，否则不要新增 telemetry、analytics 或额外网络上报。
- 如果未来引入浏览器同步、远程接口或账号体系，必须先同步补齐安全边界、配置说明和忽略规则，再继续实现。

## 7. 代码改动约束

- 优先做小而清晰的改动，不要在当前 MVP 阶段顺手做大范围重构。
- 解析逻辑优先收口在 `public/preload/chromeBookmarks.cjs`，不要把 Chrome `Bookmarks` JSON 拍平逻辑塞回前端组件。
- 新增文件系统、剪贴板、浏览器、系统调用等能力时，优先通过 `preload` 收口，再在渲染层按最小接口消费。
- `public/preload/package.json` 既然声明了 `commonjs`，后续 preload 代码要继续兼容这个约束，不要半途混入会破坏运行时的模块格式。
- 对外能力发生变化时，优先补最相关验证；当前项目至少要补一次 `npm test` 或 `npm run build`，并根据改动范围决定是否手动 smoke。
- Git 提交信息默认使用 `英文类型：中文正文`，例如 `feat: 增加书签列表初版`。
- 默认直接在 `main` 分支开发；只有用户明确要求分支隔离或 PR 流程时，才切到其他分支。
- 完成最小可验证改动后，默认创建本地 commit；如果验证通过、提交边界清晰且工作区没有无关脏改，默认继续 push 到远端。
- 以下情况不要自动 push：验证未通过、工作区混有无关修改、只做了分析没有形成可交付结果、改动里包含本地临时文件或敏感信息。
- 当前只支持 `macOS + Google Chrome Default profile`。如果新增多 profile 或多浏览器支持，必须同步更新默认路径策略、设置页文案和文档。
- 任何涉及改写 Chrome 原 `Bookmarks` 文件的需求，都不应在当前实现上顺手扩展，除非用户明确重开一轮设计和风险评估。

## 8. AGENTS.md 维护规则

后续代码更新过程中，满足以下任一条件时，必须在同一轮改动里同步更新 `AGENTS.md`：

- 项目目标、阶段或主链路发生变化
- 插件入口、`feature` 列表、目录职责或运行方式发生变化
- `preload` 暴露能力、构建方式或 uTools 联调方式发生变化
- 新增了环境变量、配置文件、测试命令或新的验证门禁
- 默认书签路径策略、支持的浏览器 / profile 范围发生变化
- 新增了后续协作者必须知道的安全边界、限制或操作前提

如果只是纯实现细节调整，且不影响协作方式、运行方式、验证方式或系统边界，可以不改 `AGENTS.md`。

## 9. 当前阶段快照

截至 `2026-04-09`，仓库状态可按下面理解：

- 当前主线已经从 uTools 官方模板切到书签工具 MVP
- 当前已具备：
  - Chrome 默认书签路径计算
  - 路径配置持久化
  - `Bookmarks` JSON 解析
  - 首页 / 设置页双视图
  - 顶部输入实时搜索
  - 插件内置顶 / 最近打开 / 打开次数
  - 首页卡片式展示与点击打开
- 当前最相关验证门禁是 `npm test` 与 `npm run build`
- 当前已知主要限制是：只支持 macOS 下的 Google Chrome 默认 profile，多个 Chrome / profile 仍需用户手动改路径
