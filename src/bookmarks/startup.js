// 仅在已初始化、路径未变化且内存中有书签时复用结果；否则仍从缓存或原文件恢复。
export function shouldReuseBookmarks({ bootstrapped, previousPath, currentPath, itemCount }) {
  return bootstrapped && previousPath === currentPath && itemCount > 0
}
