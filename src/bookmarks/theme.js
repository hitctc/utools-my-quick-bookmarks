export const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)'

export function resolveThemeMode(themeMode, prefersDark) {
  if (themeMode === 'dark' || themeMode === 'light') {
    return themeMode
  }

  return prefersDark ? 'dark' : 'light'
}

export function formatThemeStatus(themeMode, resolvedTheme) {
  return `${String(themeMode || 'system').toUpperCase()} / ${String(resolvedTheme || 'light').toUpperCase()}`
}
