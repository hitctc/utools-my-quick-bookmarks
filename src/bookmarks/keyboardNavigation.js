const ROW_TOLERANCE_PX = 8

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function isValidRect(rect, index) {
  return (
    rect &&
    rect.index === index &&
    isFiniteNumber(rect.left) &&
    isFiniteNumber(rect.right) &&
    isFiniteNumber(rect.top) &&
    isFiniteNumber(rect.bottom) &&
    isFiniteNumber(rect.centerX) &&
    isFiniteNumber(rect.centerY)
  )
}

function isSameRow(currentCenterY, candidateCenterY) {
  return Math.abs(currentCenterY - candidateCenterY) <= ROW_TOLERANCE_PX
}

function getNearestRowCenterYDown(currentCenterY, rects, currentIndex) {
  let nearest = null

  for (const rect of rects) {
    if (rect.index === currentIndex) {
      continue
    }

    const delta = rect.centerY - currentCenterY
    if (delta <= ROW_TOLERANCE_PX) {
      continue
    }

    if (nearest === null || delta < nearest) {
      nearest = delta
    }
  }

  return nearest === null ? null : currentCenterY + nearest
}

function getNearestRowCenterYUp(currentCenterY, rects, currentIndex) {
  let nearest = null

  for (const rect of rects) {
    if (rect.index === currentIndex) {
      continue
    }

    const delta = rect.centerY - currentCenterY
    if (delta >= -ROW_TOLERANCE_PX) {
      continue
    }

    if (nearest === null || delta > nearest) {
      nearest = delta
    }
  }

  return nearest === null ? null : currentCenterY + nearest
}

function pickClosestByCenterX(currentCenterX, candidates) {
  let best = candidates[0]
  let bestDistance = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    const distance = Math.abs(candidate.centerX - currentCenterX)
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }

  return best.index
}

function nearestHorizontalCandidate(current, rects, direction) {
  if (direction === 'right') {
    const candidates = rects.filter(
      (rect) => rect.index !== current.index && isSameRow(current.centerY, rect.centerY) && rect.centerX > current.centerX,
    )
    if (candidates.length === 0) {
      return null
    }
    let best = candidates[0]
    let bestDistance = Number.POSITIVE_INFINITY

    for (const candidate of candidates) {
      const distance = candidate.centerX - current.centerX
      if (distance < bestDistance) {
        bestDistance = distance
        best = candidate
      }
    }

    return best.index
  }

  const candidates = rects.filter(
    (rect) => rect.index !== current.index && isSameRow(current.centerY, rect.centerY) && rect.centerX < current.centerX,
  )
  if (candidates.length === 0) {
    return null
  }
  let best = candidates[0]
  let bestDistance = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    const distance = current.centerX - candidate.centerX
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }

  return best.index
}

export function getKeyboardNavigationResult({
  key,
  currentView,
  loading,
  hasError,
  highlightedIndex,
  entryCount,
  metaKey,
  ctrlKey,
  altKey,
}) {
  if (currentView !== 'home' || loading || hasError || metaKey || ctrlKey || altKey || entryCount <= 0) {
    return {
      action: 'noop',
      nextIndex: highlightedIndex,
      preventDefault: false,
      subInputBehavior: 'none',
    }
  }

  if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'ArrowLeft' || key === 'ArrowRight') {
    return {
      action: 'move',
      nextIndex: highlightedIndex,
      preventDefault: true,
      subInputBehavior: 'preserve',
    }
  }

  if (key === 'Enter') {
    return {
      action: 'open-current',
      nextIndex: highlightedIndex,
      preventDefault: true,
      subInputBehavior: 'none',
    }
  }

  if (key === 'Escape') {
    return {
      action: 'focus-search',
      nextIndex: highlightedIndex,
      preventDefault: false,
      subInputBehavior: 'focus',
    }
  }

  return {
    action: 'noop',
    nextIndex: highlightedIndex,
    preventDefault: false,
    subInputBehavior: 'none',
  }
}

export function getSpatialNavigationIndex({
  key,
  highlightedIndex,
  rects,
}) {
  if (!Array.isArray(rects) || !Number.isInteger(highlightedIndex) || highlightedIndex < 0 || highlightedIndex >= rects.length) {
    return highlightedIndex
  }

  if (!rects.every((rect, index) => isValidRect(rect, index))) {
    return highlightedIndex
  }

  const current = rects[highlightedIndex]

  if (key === 'ArrowRight') {
    const sameRowCandidate = nearestHorizontalCandidate(current, rects, 'right')
    if (sameRowCandidate !== null) {
      return sameRowCandidate
    }
    return Math.min(highlightedIndex + 1, rects.length - 1)
  }

  if (key === 'ArrowLeft') {
    const sameRowCandidate = nearestHorizontalCandidate(current, rects, 'left')
    if (sameRowCandidate !== null) {
      return sameRowCandidate
    }
    return Math.max(highlightedIndex - 1, 0)
  }

  if (key === 'ArrowDown') {
    const targetRowCenterY = getNearestRowCenterYDown(current.centerY, rects, highlightedIndex)
    if (targetRowCenterY === null) {
      return highlightedIndex
    }

    const sameRowCandidates = rects.filter((rect) => isSameRow(targetRowCenterY, rect.centerY))
    if (sameRowCandidates.length === 0) {
      return highlightedIndex
    }

    return pickClosestByCenterX(current.centerX, sameRowCandidates)
  }

  if (key === 'ArrowUp') {
    const targetRowCenterY = getNearestRowCenterYUp(current.centerY, rects, highlightedIndex)
    if (targetRowCenterY === null) {
      return highlightedIndex
    }

    const sameRowCandidates = rects.filter((rect) => isSameRow(targetRowCenterY, rect.centerY))
    if (sameRowCandidates.length === 0) {
      return highlightedIndex
    }

    return pickClosestByCenterX(current.centerX, sameRowCandidates)
  }

  return highlightedIndex
}
