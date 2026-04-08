# utools-my-quick-bookmarks 协作文档

## 1. 文档目标

这份 `AGENTS.md` 用来约束本项目内的协作方式，优先级高于上层那些不够贴近本仓库现状的通用规则。

它主要解决四件事：

- 让进入仓库的协作者先快速知道这个项目现在做到哪一步、怎么运行、主要代码在哪。
- 让后续改动优先沿着当前 uTools 插件模板结构继续推进，不在初始化阶段随手发散重构。
- 让协作者明确哪些地方还是模板示例，避免把“未来目标”和“当前实现”混在一起。
- 让 `AGENTS.md` 跟着代码一起维护，不变成只在第一次初始化时有用的静态说明。

## 2. 项目当前定位

- 项目名称：`utools-my-quick-bookmarks`
- 目标方向：做成一个在 `uTools` 内快速展示、搜索、查看、打开书签的工具
- 当前阶段：初始化脚手架阶段，远未进入真正的“书签管理 / 搜索 / 打开”业务实现
- 当前真实能力：仍然是 `uTools + Vue 3 + Vite` 模板自带的 `hello / read / write` 三个示例能力
- 当前技术栈：`Vue 3 + Vite 6 + @vitejs/plugin-vue + utools-api-types`
- 当前运行模型：
  - `uTools 进入插件 -> 读取 action.code -> src/App.vue 按 code 切换组件`
  - `public/preload/services.js` 通过 `window.services` 向渲染进程暴露 Node.js 能力
  - `window.utools` 负责插件生命周期、文件选择、通知和系统交互

当前仓库虽然叫“quick bookmarks”，但代码层面还没有任何真实书签领域模型、存储结构、搜索逻辑或打开链接逻辑。后续协作者不要把 README 的目标描述误当成“已实现能力”。

## 3. 关键目录与职责

- `public/plugin.json`
  uTools 插件清单文件，定义插件入口、`preload` 路径、开发态地址和功能指令匹配规则。
- `public/preload/package.json`
  固定 `preload` 目录使用 `commonjs`，不要在这里随意切成 ESM。
- `public/preload/services.js`
  负责向渲染进程注入 Node.js 能力；当前只提供读文件、写文本文件、写图片文件三个示例方法。
- `src/App.vue`
  负责监听 `window.utools.onPluginEnter`，根据 `action.code` 切换当前展示组件，是插件 UI 总入口。
- `src/Hello/index.vue`
  `hello` 示例页，展示进入参数。
- `src/Read/index.vue`
  `read` 示例页，负责选择文件或读取由 uTools 传入的文件内容。
- `src/Write/index.vue`
  `write` 示例页，负责把文本或图片保存到下载目录，并在系统文件管理器中定位。
- `src/main.js`
  Vue 客户端挂载入口。
- `src/main.css`
  全局基础样式。
- `vite.config.js`
  Vite 构建配置；当前 `base` 固定为 `./`，用于适配 uTools 本地资源加载。
- `dist/`
  构建产物目录；`npm run build` 后会生成 `dist/index.html`、`dist/plugin.json`、`dist/preload/*` 和静态资源，供 uTools 实际加载。
- `README.md`
  当前只有一行目标说明；如果项目开始进入真实书签业务实现，要同步补齐更准确的使用说明。

## 4. 当前能力与入口约定

当前插件能力全部由 `public/plugin.json` 中的 `features` 决定，并且必须和 `src/App.vue` 的组件分发保持同步。

当前已定义的 feature：

- `hello`
  通过 `你好`、`hello` 进入，展示插件进入参数。
- `read`
  通过 `读文件` 或匹配单个文件进入，读取文件内容并显示。
- `write`
  通过 `over` / `img` 类型进入，把文本或图片写入下载目录；`mainHide` 已开启，不在主列表里展示。

当前关键约定：

- 如果新增或重命名 `feature.code`，必须同步更新：
  - `public/plugin.json`
  - `src/App.vue`
  - 对应功能组件目录
  - `README.md` 与 `AGENTS.md` 中的能力说明
- 所有需要 Node.js 权限的能力，优先放到 `public/preload/services.js`，再通过 `window.services` 给前端使用；不要把文件系统能力直接散落到渲染层各处。
- 当前 UI 路由不是 `vue-router`，而是基于 `uTools action.code` 的轻量条件渲染。除非需求明确升级，否则不要在初始化阶段直接引入完整路由系统或复杂状态管理。
- 当前仓库没有真实书签数据模型。只要开始引入书签列表、分类、搜索索引、打开网址、导入导出等能力，就意味着项目已经从“模板阶段”进入“业务实现阶段”，需要同步更新本文档的阶段描述。

## 5. 运行与验证

首次进入仓库先确认依赖状态。当前工作区可能没有安装依赖，不要默认 `node_modules` 已存在。

常用命令：

- 安装依赖：`npm install`
- 本地开发：`npm run dev`
- 生产构建：`npm run build`

当前开发方式约定：

- `npm run dev` 会启动 Vite 开发服务，默认地址是 `http://localhost:5173`
- `public/plugin.json` 的 `development.main` 已指向这个地址
- uTools 实际加载时依赖 `dist/plugin.json`，因此首次本地联调前通常要先跑一次 `npm run build`
- 构建完成后，可把 `dist/` 作为 uTools 插件目录加载；开发态会根据 `development.main` 自动转向本地 Vite 服务

当前推荐验证顺序：

1. 只改文档或注释时，先做文档自检，确认说明与真实代码一致。
2. 改了前端界面、插件入口、`plugin.json`、`preload` 或构建配置时，至少跑一次 `npm run build`。
3. 改了 `feature` 匹配、uTools 生命周期或文件读写能力时，跑完 `npm run build` 后再做一次手动 uTools smoke test。
4. 如果后续引入自动化测试，本节要同步更新，不再继续维持“只有 build 门禁”的表述。

当前推荐 smoke test：

1. 运行 `npm run build`
2. 运行 `npm run dev`
3. 在 uTools 开发者工具中加载 `dist/`
4. 通过 `你好` 或 `hello` 进入插件，确认 `hello` 示例页正常显示
5. 通过 `读文件` 或文件匹配进入插件，确认读取流程可用
6. 通过文本选中或图片触发 `write`，确认文件能写入下载目录并被系统定位

当前仓库还没有测试框架、测试脚本和 `.env.example`。如果后续补上这些能力，必须同步更新 `AGENTS.md`、`README.md` 和相关命令说明。

## 6. 配置与安全约束

- 当前项目没有业务环境变量需求；如果后续引入配置，优先明确哪些是非敏感配置、哪些必须走环境变量。
- 不要把 secrets、tokens、cookies、授权码、私有路径或测试账号写进仓库。
- 当前 `preload` 具备 Node.js 文件系统能力；新增能力时优先控制边界，不要默认把过多系统权限直接暴露给前端。
- 除非需求明确变化，否则不要新增 telemetry、analytics 或额外网络上报。
- 如果未来引入书签同步、远程接口或账号体系，必须先同步补齐安全边界、配置说明和忽略规则，再继续实现。

## 7. 代码改动约束

- 优先做小而清晰的改动，不要在模板阶段顺手做大范围重构。
- 默认直接沿用当前 `feature -> App.vue 条件分发 -> 功能组件` 的结构继续开发；如果要改成新的组织方式，需要先确保收益明确且同步更新文档。
- 新增文件系统、剪贴板、浏览器、系统调用等能力时，优先通过 `preload` 收口，再在渲染层按最小接口消费。
- `public/preload/package.json` 既然声明了 `commonjs`，后续 preload 代码要继续兼容这个约束，不要半途混入会破坏运行时的模块格式。
- 对外能力发生变化时，优先补最相关验证。当前项目还没有测试体系，因此至少要补一次 `npm run build` 和最相关手动验证。
- Git 提交信息默认使用 `英文类型：中文正文`，例如 `feat: 增加书签列表初版`。
- 默认直接在 `main` 分支开发；只有用户明确要求分支隔离或 PR 流程时，才切到其他分支。
- 完成最小可验证改动后，默认创建本地 commit；如果验证通过、提交边界清晰且工作区没有无关脏改，默认继续 push 到远端。
- 以下情况不要自动 push：验证未通过、工作区混有无关修改、只做了分析没有形成可交付结果、改动里包含本地临时文件或敏感信息。
- 如果开始实现真正的书签业务能力，不要继续保留 `Hello / Read / Write` 这些模板命名；应在同一轮内同步完成组件重命名和文档更新，避免仓库语义长期错位。

## 8. AGENTS.md 维护规则

后续代码更新过程中，满足以下任一条件时，必须在同一轮改动里同步更新 `AGENTS.md`：

- 项目目标、阶段或主链路发生变化
- 插件入口、`feature` 列表、目录职责或运行方式发生变化
- `preload` 暴露能力、构建方式或 uTools 联调方式发生变化
- 新增了环境变量、配置文件、测试命令或新的验证门禁
- 仓库从“模板阶段”进入“真实书签业务实现阶段”
- 新增了后续协作者必须知道的安全边界、限制或操作前提

如果只是纯实现细节调整，且不影响协作方式、运行方式、验证方式或系统边界，可以不改 `AGENTS.md`。

## 9. 当前阶段快照

截至 `2026-04-08`，仓库状态可按下面理解：

- 初始化模板代码已提交并同步远端 `origin/main`
- 当前主分支已包含一次初始化提交：`fba8e31`
- 当前最相关验证为 `npm run build`，已通过
- 当前没有自动化测试、业务环境变量和真实书签数据结构
- 当前仓库仍以 uTools 官方模板演示能力为主，离“快速书签工具”的目标还有明显实现距离
