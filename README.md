# utools-my-quick-bookmarks

一个运行在 uTools 内的书签工具，当前先支持 macOS 下读取 Google Chrome 默认 profile 的书签文件。

## 当前能力

- 默认读取 `~/Library/Application Support/Google/Chrome/Default/Bookmarks`
- 首页以卡片方式展示解析后的书签
- 使用 uTools 顶部输入框实时搜索 `标题 / URL / 目录路径`
- 支持方向键切换高亮卡片，回车直接打开书签
- 点击卡片用系统默认浏览器打开书签
- 支持插件内置顶 / 取消置顶
- 支持记录最近打开与打开次数
- 首页右上角提供设置入口
- 设置页支持修改书签文件路径、恢复默认路径和刷新书签
- 设置页支持配置“首页显示最近打开”“显示打开次数”

## 当前限制

- 当前只支持 `macOS + Google Chrome`
- 默认路径只针对 Chrome 的 `Default` profile
- 如果用户常用的不是这个 profile，需要在设置页手动修改路径
- 当前所有置顶、最近打开、打开次数都只保存在插件本地，不回写 Chrome 原书签文件
- 不支持在插件里修改书签名称、地址、位置，也不做重复书签检查

## 开发

```bash
npm install
npm test
npm run dev
```

接入开发时，使用 uTools 开发者工具加载仓库中的 `public/plugin.json`。

进入插件后，继续使用 uTools 顶部输入框搜索，不在页面里额外提供一个搜索框。

## 构建

```bash
npm run build
```

构建后会在 `dist/` 下生成 `plugin.json`、`preload/` 和前端静态资源。
