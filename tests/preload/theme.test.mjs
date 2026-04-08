import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SYSTEM_THEME_QUERY,
  formatThemeStatus,
  resolveThemeMode,
} from '../../src/bookmarks/theme.js'

test('SYSTEM_THEME_QUERY keeps the media query used for dark mode detection', () => {
  assert.equal(SYSTEM_THEME_QUERY, '(prefers-color-scheme: dark)')
})

test('resolveThemeMode returns explicit theme values unchanged', () => {
  assert.equal(resolveThemeMode('dark', false), 'dark')
  assert.equal(resolveThemeMode('light', true), 'light')
})

test('resolveThemeMode maps system theme mode from prefersDark', () => {
  assert.equal(resolveThemeMode('system', true), 'dark')
  assert.equal(resolveThemeMode('system', false), 'light')
})

test('formatThemeStatus renders the selected mode and resolved theme', () => {
  assert.equal(formatThemeStatus('system', 'dark'), 'SYSTEM / DARK')
})
