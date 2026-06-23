import { createContext, useContext } from 'react'

export type ColorTheme = 'dark' | 'light'
export type BoardTheme = 'classic' | 'green' | 'blue' | 'walnut' | 'ice' | 'purple'

export type BoardColors = { light: Record<string, string>; dark: Record<string, string> }

export const BOARD_THEMES: Record<BoardTheme, { name: string } & BoardColors> = {
  classic: { name: 'Classic',  light: { background: '#f0d9b5' }, dark: { background: '#b58863' } },
  green:   { name: 'Green',    light: { background: '#ffffdd' }, dark: { background: '#86a666' } },
  blue:    { name: 'Blue',     light: { background: '#dee3e6' }, dark: { background: '#8ca2ad' } },
  walnut:  { name: 'Walnut',   light: { background: '#f0c99a' }, dark: { background: '#a0653e' } },
  ice:     { name: 'Ice',      light: { background: '#e8f0f7' }, dark: { background: '#5f8db5' } },
  purple:  { name: 'Purple',   light: { background: '#e8d8f0' }, dark: { background: '#8860a8' } },
}

export type AnalyzeEngine = 'browser' | 'server'

export type Settings = { colorTheme: ColorTheme; boardTheme: BoardTheme; analyzeEngine: AnalyzeEngine }

export const DEFAULT_SETTINGS: Settings = { colorTheme: 'dark', boardTheme: 'classic', analyzeEngine: 'browser' }

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem('kibitz-settings')
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_SETTINGS
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem('kibitz-settings', JSON.stringify(s)) } catch {}
}

export const SettingsContext = createContext<{
  settings: Settings
  setSettings: (s: Settings) => void
}>({ settings: DEFAULT_SETTINGS, setSettings: () => {} })

export function useSettings() { return useContext(SettingsContext) }
