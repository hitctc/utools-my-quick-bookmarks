function toSafeText(value) {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function toSearchTokens(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return []
  }

  return tokens.map(token => toSafeText(token).trim().toLowerCase()).filter(Boolean)
}

function tokenMatchesText(token, text) {
  return toSafeText(text).toLowerCase().includes(token)
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

  const tokenMatches = searchTokens.map(token => ({
    token,
    title: tokenMatchesText(token, title),
    url: tokenMatchesText(token, url),
    folder: tokenMatchesText(token, folderLabel),
    site: tokenMatchesText(token, siteLabel),
  }))

  const matches = searchTokens.length
    ? tokenMatches.every(entry => entry.title || entry.url || entry.folder || entry.site)
    : true

  const urlOnlyMatch =
    Boolean(searchTokens.length && matches) &&
    tokenMatches.every(entry => entry.url && !entry.title && !entry.folder && !entry.site)

  return {
    matches,
    urlOnlyMatch,
    title,
    url,
    folderLabel,
    siteLabel,
    highlightedTitleSegments: getFieldSegments(title, matches, searchTokens),
    highlightedUrlSegments: getFieldSegments(url, matches, searchTokens),
    highlightedFolderSegments: getFieldSegments(folderLabel, matches, searchTokens),
    highlightedSiteSegments: getFieldSegments(siteLabel, matches, searchTokens),
  }
}
