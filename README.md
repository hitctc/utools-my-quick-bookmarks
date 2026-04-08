# utools-my-quick-bookmarks

一个运行在 uTools 内的书签工具，当前先支持 macOS 下读取 Google Chrome 默认 profile 的书签文件。

## 当前能力

- 默认读取 `~/Library/Application Support/Google/Chrome/Default/Bookmarks`
- 首页展示解析后的书签列表
- 首页右上角提供设置入口
- 设置页支持修改书签文件路径、恢复默认路径和重新读取

## 当前限制

- 当前只支持 `macOS + Google Chrome`
- 默认路径只针对 Chrome 的 `Default` profile
- 如果用户常用的不是这个 profile，需要在设置页手动修改路径
- 这轮还没做书签搜索、排序和打开网址

## 开发

```bash
npm install
npm test
npm run dev
```

接入开发时，使用 uTools 开发者工具加载仓库中的 `public/plugin.json`。

## 构建

```bash
npm run build
```

构建后会在 `dist/` 下生成 `plugin.json`、`preload/` 和前端静态资源。
