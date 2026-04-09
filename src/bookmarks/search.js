import { pinyin } from 'pinyin-pro'

const TITLE_SEARCH_ALIAS_CACHE = new Map()

function toSafeText(value) {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function normalizeAliasText(value) {
  return toSafeText(value).trim().toLowerCase()
}

function toSearchTokens(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return []
  }

  return tokens.map(token => normalizeAliasText(token)).filter(Boolean)
}

function tokenMatchesText(token, text) {
  return normalizeAliasText(text).includes(token)
}

function hasChineseCharacter(text) {
  return /[\u3400-\u9fff]/u.test(text)
}

// 标题拼音索引只在中文标题场景下生成，避免把英文标题也扩成额外搜索语义。
function getTitleSearchAliases(title) {
  const normalizedTitle = normalizeAliasText(title)

  if (!normalizedTitle) {
    return {
      normalizedTitle: '',
      fullPinyin: '',
      initials: '',
    }
  }

  const cachedAliases = TITLE_SEARCH_ALIAS_CACHE.get(normalizedTitle)
  if (cachedAliases) {
    return cachedAliases
  }

  const aliases = {
    normalizedTitle,
    fullPinyin: '',
    initials: '',
  }

  if (hasChineseCharacter(normalizedTitle)) {
    aliases.fullPinyin = normalizeAliasText(
      pinyin(normalizedTitle, { toneType: 'none' }).replace(/\s+/g, ''),
    )
    aliases.initials = normalizeAliasText(
      pinyin(normalizedTitle, { pattern: 'first', toneType: 'none' }).replace(/\s+/g, ''),
    )
  }

  TITLE_SEARCH_ALIAS_CACHE.set(normalizedTitle, aliases)
  return aliases
}

function buildStableSegments(text) {
  return [{ text: toSafeText(text), matched: false }]
}

// 把用户输入拆成稳定的搜索 token，方便后续做 AND 匹配。
export function normalizeSearchTokens(query) {
  const text = toSafeText(query).trim()

  if (!text) {
    return []
  }

  return text.split(/\s+/).map(token => token.toLowerCase()).filter(Boolean)
}

// 尝试从书签 URL 里提取可展示的站点标签，解析失败时回退原始文本。
export function getBookmarkSiteLabel(url) {
  const text = toSafeText(url).trim()

  if (!text) {
    return ''
  }

  try {
    return new URL(text).host
  } catch {
    return text
  }
}

// 把目录路径格式化成统一的展示文本，空目录时回退到“未分类”。
export function getBookmarkFolderLabel(folderPath) {
  if (!Array.isArray(folderPath)) {
    return '未分类'
  }

  const labels = folderPath
    .map(segment => toSafeText(segment).trim())
    .filter(Boolean)

  return labels.length ? labels.join(' / ') : '未分类'
}

function getBookmarkRootLabel(sourceRoot) {
  if (sourceRoot === 'bookmark_bar') {
    return '书签栏'
  }

  if (sourceRoot === 'other') {
    return '其他书签'
  }

  if (sourceRoot === 'synced') {
    return '已同步'
  }

  return '未分类'
}

// 把 Chrome 书签真实目录路径格式化成可读文案，保留根目录和文件夹层级。
export function getBookmarkPathLabel(folderPath, sourceRoot) {
  const rootLabel = getBookmarkRootLabel(sourceRoot)
  const labels = Array.isArray(folderPath)
    ? folderPath.map(segment => toSafeText(segment).trim()).filter(Boolean)
    : []

  return [rootLabel, ...labels].join('/')
}

// 按 token 做大小写不敏感高亮，返回带 matched 标记的连续片段。
export function buildHighlightedSegments(text, tokens) {
  const sourceText = toSafeText(text)
  const searchTokens = toSearchTokens(tokens)

  if (!sourceText) {
    return [{ text: '', matched: false }]
  }

  if (!searchTokens.length) {
    return [{ text: sourceText, matched: false }]
  }

  const lowerText = sourceText.toLowerCase()
  const matchedFlags = Array.from({ length: sourceText.length }, () => false)

  for (const token of searchTokens) {
    let startIndex = 0

    while (startIndex < lowerText.length) {
      const foundIndex = lowerText.indexOf(token, startIndex)
      if (foundIndex === -1) {
        break
      }

      for (let index = foundIndex; index < foundIndex + token.length; index += 1) {
        matchedFlags[index] = true
      }

      startIndex = foundIndex + Math.max(token.length, 1)
    }
  }

  const segments = []
  let segmentStart = 0
  let segmentMatched = matchedFlags[0]

  for (let index = 1; index < sourceText.length; index += 1) {
    if (matchedFlags[index] !== segmentMatched) {
      segments.push({
        text: sourceText.slice(segmentStart, index),
        matched: segmentMatched,
      })
      segmentStart = index
      segmentMatched = matchedFlags[index]
    }
  }

  segments.push({
    text: sourceText.slice(segmentStart),
    matched: segmentMatched,
  })

  return segments
}

function getFieldSegments(text, shouldHighlight, tokens) {
  return shouldHighlight ? buildHighlightedSegments(text, tokens) : buildStableSegments(text)
}

// 汇总一个书签的可搜索信息，并判断它是否满足多关键词 AND 搜索。
export function getBookmarkSearchMeta(item, tokens) {
  const searchTokens = toSearchTokens(tokens)
  const title = toSafeText(item?.title).trim() || '未命名书签'
  const url = toSafeText(item?.url).trim()
  const folderLabel = getBookmarkFolderLabel(item?.folderPath)
  const siteLabel = getBookmarkSiteLabel(url)
  const pathLabel = getBookmarkPathLabel(item?.folderPath, item?.sourceRoot)
  const titleAliases = getTitleSearchAliases(title)

  const tokenMatches = searchTokens.map(token => ({
    token,
    title:
      tokenMatchesText(token, titleAliases.normalizedTitle)
      || tokenMatchesText(token, titleAliases.fullPinyin)
      || tokenMatchesText(token, titleAliases.initials),
    url: tokenMatchesText(token, url),
    folder: tokenMatchesText(token, folderLabel),
    site: tokenMatchesText(token, siteLabel),
    path: tokenMatchesText(token, pathLabel),
  }))

  const matches = searchTokens.length
    ? tokenMatches.every(entry => entry.title || entry.url || entry.folder || entry.site || entry.path)
    : true

  const urlOnlyMatch =
    Boolean(searchTokens.length && matches) &&
    tokenMatches.every(entry => entry.url && !entry.title && !entry.folder && !entry.site && !entry.path)

  return {
    matches,
    urlOnlyMatch,
    title,
    url,
    folderLabel,
    siteLabel,
    pathLabel,
    highlightedTitleSegments: getFieldSegments(title, matches, searchTokens),
    highlightedUrlSegments: getFieldSegments(url, matches, searchTokens),
    highlightedFolderSegments: getFieldSegments(folderLabel, matches, searchTokens),
    highlightedSiteSegments: getFieldSegments(siteLabel, matches, searchTokens),
    highlightedPathSegments: getFieldSegments(pathLabel, matches, searchTokens),
  }
}
