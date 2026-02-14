import type { ThemeName } from './types'

interface ThemeTokens {
  label: string
  emoji: string       // Theme icon for picker
  agentEmoji: string  // Bot avatar in chat (changes per theme)
  glassBg: string
  glassBgStrong: string
  glassSidebar: string
  glassElevated: string
  glassInput: string
  glassInputHover: string
  borderHairline: string
  borderSubtle: string
  borderFocus: string
  accent: string
  accentHover: string
  accentMuted: string
  accentGlow: string
  danger: string
  dangerMuted: string
  success: string
  warning: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
  textOnAccent: string
  bodyBg: string
  ambientA: string
  ambientB: string
}

export const THEMES: Record<ThemeName, ThemeTokens> = {
  glass: {
    label: 'Glass',
    emoji: '\u{1F52E}',
    agentEmoji: '\u{1F916}',
    glassBg: 'rgba(38,38,48,0.82)',
    glassBgStrong: 'rgba(44,44,56,0.90)',
    glassSidebar: 'rgba(30,30,42,0.85)',
    glassElevated: 'rgba(55,55,72,0.75)',
    glassInput: 'rgba(255,255,255,0.07)',
    glassInputHover: 'rgba(255,255,255,0.11)',
    borderHairline: 'rgba(255,255,255,0.12)',
    borderSubtle: 'rgba(255,255,255,0.18)',
    borderFocus: 'rgba(120,160,255,0.6)',
    accent: '#7eb4ff',
    accentHover: '#96c4ff',
    accentMuted: 'rgba(126,180,255,0.20)',
    accentGlow: 'rgba(126,180,255,0.35)',
    danger: '#ff7b8a',
    dangerMuted: 'rgba(255,123,138,0.18)',
    success: '#73f0cc',
    warning: '#ffe080',
    textPrimary: 'rgba(255,255,255,0.94)',
    textSecondary: 'rgba(255,255,255,0.62)',
    textTertiary: 'rgba(255,255,255,0.38)',
    textOnAccent: '#fff',
    bodyBg: '#16161e',
    ambientA: 'rgba(90,130,220,0.14)',
    ambientB: 'rgba(150,90,210,0.10)',
  },
  forest: {
    label: 'Forest',
    emoji: '\u{1F332}',
    agentEmoji: '\u{1F43B}',
    glassBg: 'rgba(28,40,30,0.82)',
    glassBgStrong: 'rgba(34,48,36,0.90)',
    glassSidebar: 'rgba(22,34,24,0.85)',
    glassElevated: 'rgba(42,62,45,0.75)',
    glassInput: 'rgba(255,255,255,0.07)',
    glassInputHover: 'rgba(255,255,255,0.11)',
    borderHairline: 'rgba(255,255,255,0.10)',
    borderSubtle: 'rgba(255,255,255,0.16)',
    borderFocus: 'rgba(110,210,140,0.6)',
    accent: '#6ccf8e',
    accentHover: '#80dda0',
    accentMuted: 'rgba(108,207,142,0.20)',
    accentGlow: 'rgba(108,207,142,0.35)',
    danger: '#f07070',
    dangerMuted: 'rgba(240,112,112,0.18)',
    success: '#73f0cc',
    warning: '#f0d860',
    textPrimary: 'rgba(235,245,237,0.94)',
    textSecondary: 'rgba(235,245,237,0.62)',
    textTertiary: 'rgba(235,245,237,0.38)',
    textOnAccent: '#fff',
    bodyBg: '#121a14',
    ambientA: 'rgba(70,160,90,0.14)',
    ambientB: 'rgba(50,120,70,0.10)',
  },
  ocean: {
    label: 'Ocean',
    emoji: '\u{1F30A}',
    agentEmoji: '\u{1F42C}',
    glassBg: 'rgba(24,36,52,0.82)',
    glassBgStrong: 'rgba(30,44,60,0.90)',
    glassSidebar: 'rgba(20,30,44,0.85)',
    glassElevated: 'rgba(38,56,78,0.75)',
    glassInput: 'rgba(255,255,255,0.07)',
    glassInputHover: 'rgba(255,255,255,0.11)',
    borderHairline: 'rgba(255,255,255,0.10)',
    borderSubtle: 'rgba(255,255,255,0.16)',
    borderFocus: 'rgba(90,190,230,0.6)',
    accent: '#5cc8e8',
    accentHover: '#70daf0',
    accentMuted: 'rgba(92,200,232,0.20)',
    accentGlow: 'rgba(92,200,232,0.35)',
    danger: '#f07080',
    dangerMuted: 'rgba(240,112,128,0.18)',
    success: '#60e8b0',
    warning: '#f0d860',
    textPrimary: 'rgba(225,240,250,0.94)',
    textSecondary: 'rgba(225,240,250,0.62)',
    textTertiary: 'rgba(225,240,250,0.38)',
    textOnAccent: '#fff',
    bodyBg: '#0e1620',
    ambientA: 'rgba(60,130,200,0.14)',
    ambientB: 'rgba(40,100,180,0.10)',
  },
  ember: {
    label: 'Ember',
    emoji: '\u{1F525}',
    agentEmoji: '\u{1F985}',
    glassBg: 'rgba(45,30,24,0.82)',
    glassBgStrong: 'rgba(54,38,30,0.90)',
    glassSidebar: 'rgba(38,26,20,0.85)',
    glassElevated: 'rgba(70,48,38,0.75)',
    glassInput: 'rgba(255,255,255,0.07)',
    glassInputHover: 'rgba(255,255,255,0.11)',
    borderHairline: 'rgba(255,255,255,0.10)',
    borderSubtle: 'rgba(255,255,255,0.16)',
    borderFocus: 'rgba(250,150,90,0.6)',
    accent: '#f09a5e',
    accentHover: '#f8ae78',
    accentMuted: 'rgba(240,154,94,0.20)',
    accentGlow: 'rgba(240,154,94,0.35)',
    danger: '#f07070',
    dangerMuted: 'rgba(240,112,112,0.18)',
    success: '#73f0cc',
    warning: '#ffe080',
    textPrimary: 'rgba(250,235,225,0.94)',
    textSecondary: 'rgba(250,235,225,0.62)',
    textTertiary: 'rgba(250,235,225,0.38)',
    textOnAccent: '#fff',
    bodyBg: '#1a120e',
    ambientA: 'rgba(220,110,60,0.14)',
    ambientB: 'rgba(180,70,40,0.10)',
  },
  midnight: {
    label: 'Midnight',
    emoji: '\u{1F319}',
    agentEmoji: '\u{1F987}',
    glassBg: 'rgba(24,24,40,0.84)',
    glassBgStrong: 'rgba(30,30,50,0.92)',
    glassSidebar: 'rgba(18,18,32,0.88)',
    glassElevated: 'rgba(36,36,60,0.75)',
    glassInput: 'rgba(255,255,255,0.06)',
    glassInputHover: 'rgba(255,255,255,0.10)',
    borderHairline: 'rgba(255,255,255,0.09)',
    borderSubtle: 'rgba(255,255,255,0.14)',
    borderFocus: 'rgba(150,130,255,0.6)',
    accent: '#9b88ff',
    accentHover: '#b0a0ff',
    accentMuted: 'rgba(155,136,255,0.20)',
    accentGlow: 'rgba(155,136,255,0.35)',
    danger: '#ff7b8a',
    dangerMuted: 'rgba(255,123,138,0.18)',
    success: '#73f0cc',
    warning: '#ffe080',
    textPrimary: 'rgba(235,233,250,0.94)',
    textSecondary: 'rgba(235,233,250,0.60)',
    textTertiary: 'rgba(235,233,250,0.35)',
    textOnAccent: '#fff',
    bodyBg: '#0c0c16',
    ambientA: 'rgba(110,90,220,0.14)',
    ambientB: 'rgba(70,50,180,0.10)',
  },
  slate: {
    label: 'Slate',
    emoji: '\u{1FAA8}',
    agentEmoji: '\u{1F9BE}',
    glassBg: 'rgba(40,42,48,0.82)',
    glassBgStrong: 'rgba(48,50,58,0.90)',
    glassSidebar: 'rgba(32,34,40,0.85)',
    glassElevated: 'rgba(58,62,70,0.75)',
    glassInput: 'rgba(255,255,255,0.07)',
    glassInputHover: 'rgba(255,255,255,0.11)',
    borderHairline: 'rgba(255,255,255,0.12)',
    borderSubtle: 'rgba(255,255,255,0.18)',
    borderFocus: 'rgba(170,180,200,0.6)',
    accent: '#98a9bb',
    accentHover: '#aabbcc',
    accentMuted: 'rgba(152,169,187,0.20)',
    accentGlow: 'rgba(152,169,187,0.30)',
    danger: '#f07080',
    dangerMuted: 'rgba(240,112,128,0.18)',
    success: '#73f0cc',
    warning: '#f0d860',
    textPrimary: 'rgba(244,244,248,0.92)',
    textSecondary: 'rgba(244,244,248,0.60)',
    textTertiary: 'rgba(244,244,248,0.36)',
    textOnAccent: '#fff',
    bodyBg: '#161820',
    ambientA: 'rgba(110,120,150,0.10)',
    ambientB: 'rgba(90,100,130,0.08)',
  },
  sand: {
    label: 'Sand',
    emoji: '\u{1F3DC}',
    agentEmoji: '\u{1F42A}',
    glassBg: 'rgba(48,42,34,0.82)',
    glassBgStrong: 'rgba(56,50,40,0.90)',
    glassSidebar: 'rgba(40,34,26,0.85)',
    glassElevated: 'rgba(68,60,48,0.75)',
    glassInput: 'rgba(255,255,255,0.07)',
    glassInputHover: 'rgba(255,255,255,0.11)',
    borderHairline: 'rgba(255,255,255,0.10)',
    borderSubtle: 'rgba(255,255,255,0.16)',
    borderFocus: 'rgba(210,190,150,0.6)',
    accent: '#d8b880',
    accentHover: '#e4c898',
    accentMuted: 'rgba(216,184,128,0.20)',
    accentGlow: 'rgba(216,184,128,0.35)',
    danger: '#e07060',
    dangerMuted: 'rgba(224,112,96,0.18)',
    success: '#73f0cc',
    warning: '#f0d860',
    textPrimary: 'rgba(250,245,235,0.94)',
    textSecondary: 'rgba(250,245,235,0.62)',
    textTertiary: 'rgba(250,245,235,0.38)',
    textOnAccent: '#fff',
    bodyBg: '#181610',
    ambientA: 'rgba(180,150,90,0.12)',
    ambientB: 'rgba(140,110,70,0.08)',
  },
  rose: {
    label: 'Rose',
    emoji: '\u{1F339}',
    agentEmoji: '\u{1F98B}',
    glassBg: 'rgba(45,28,36,0.82)',
    glassBgStrong: 'rgba(54,36,44,0.90)',
    glassSidebar: 'rgba(38,24,30,0.85)',
    glassElevated: 'rgba(68,46,56,0.75)',
    glassInput: 'rgba(255,255,255,0.07)',
    glassInputHover: 'rgba(255,255,255,0.11)',
    borderHairline: 'rgba(255,255,255,0.10)',
    borderSubtle: 'rgba(255,255,255,0.16)',
    borderFocus: 'rgba(230,130,170,0.6)',
    accent: '#e880a8',
    accentHover: '#f094ba',
    accentMuted: 'rgba(232,128,168,0.20)',
    accentGlow: 'rgba(232,128,168,0.35)',
    danger: '#f07070',
    dangerMuted: 'rgba(240,112,112,0.18)',
    success: '#73f0cc',
    warning: '#f0d860',
    textPrimary: 'rgba(250,235,240,0.94)',
    textSecondary: 'rgba(250,235,240,0.62)',
    textTertiary: 'rgba(250,235,240,0.38)',
    textOnAccent: '#fff',
    bodyBg: '#1a0e16',
    ambientA: 'rgba(200,90,140,0.14)',
    ambientB: 'rgba(160,60,110,0.10)',
  },
  cyber: {
    label: 'Cyber',
    emoji: '\u{1F4BB}',
    agentEmoji: '\u{1F47E}',
    glassBg: 'rgba(0,10,0,0.90)',
    glassBgStrong: 'rgba(0,15,0,0.95)',
    glassSidebar: 'rgba(0,8,0,0.92)',
    glassElevated: 'rgba(0,20,5,0.80)',
    glassInput: 'rgba(0,255,65,0.06)',
    glassInputHover: 'rgba(0,255,65,0.10)',
    borderHairline: 'rgba(0,255,65,0.15)',
    borderSubtle: 'rgba(0,255,65,0.22)',
    borderFocus: 'rgba(0,255,65,0.6)',
    accent: '#00ff41',
    accentHover: '#33ff66',
    accentMuted: 'rgba(0,255,65,0.15)',
    accentGlow: 'rgba(0,255,65,0.40)',
    danger: '#ff3355',
    dangerMuted: 'rgba(255,51,85,0.18)',
    success: '#00ff41',
    warning: '#ffcc00',
    textPrimary: 'rgba(0,255,65,0.92)',
    textSecondary: 'rgba(0,255,65,0.60)',
    textTertiary: 'rgba(0,255,65,0.35)',
    textOnAccent: '#000',
    bodyBg: '#000000',
    ambientA: 'rgba(0,255,65,0.08)',
    ambientB: 'rgba(0,200,50,0.05)',
  },
  classic: {
    label: 'Classic',
    emoji: '\u{2764}',
    agentEmoji: '\u{1F916}',
    glassBg: 'rgba(34,34,48,0.82)',
    glassBgStrong: 'rgba(42,42,58,0.90)',
    glassSidebar: 'rgba(28,28,40,0.85)',
    glassElevated: 'rgba(52,52,68,0.75)',
    glassInput: 'rgba(255,255,255,0.07)',
    glassInputHover: 'rgba(255,255,255,0.11)',
    borderHairline: 'rgba(255,255,255,0.12)',
    borderSubtle: 'rgba(255,255,255,0.18)',
    borderFocus: 'rgba(240,80,108,0.6)',
    accent: '#f05878',
    accentHover: '#f87090',
    accentMuted: 'rgba(240,88,120,0.20)',
    accentGlow: 'rgba(240,88,120,0.35)',
    danger: '#f05878',
    dangerMuted: 'rgba(240,88,120,0.18)',
    success: '#40dd80',
    warning: '#f8d820',
    textPrimary: 'rgba(242,242,242,0.94)',
    textSecondary: 'rgba(242,242,242,0.62)',
    textTertiary: 'rgba(242,242,242,0.38)',
    textOnAccent: '#fff',
    bodyBg: '#171722',
    ambientA: 'rgba(120,50,90,0.14)',
    ambientB: 'rgba(100,40,70,0.10)',
  },
  light: {
    label: 'Light',
    emoji: '\u2600',
    agentEmoji: '\u{1F916}',
    glassBg: 'rgba(255,255,255,0.85)',
    glassBgStrong: 'rgba(255,255,255,0.92)',
    glassSidebar: 'rgba(245,245,250,0.90)',
    glassElevated: 'rgba(255,255,255,0.80)',
    glassInput: 'rgba(0,0,0,0.04)',
    glassInputHover: 'rgba(0,0,0,0.07)',
    borderHairline: 'rgba(0,0,0,0.08)',
    borderSubtle: 'rgba(0,0,0,0.14)',
    borderFocus: 'rgba(60,120,240,0.5)',
    accent: '#3b82f6',
    accentHover: '#2563eb',
    accentMuted: 'rgba(59,130,246,0.12)',
    accentGlow: 'rgba(59,130,246,0.20)',
    danger: '#ef4444',
    dangerMuted: 'rgba(239,68,68,0.12)',
    success: '#22c55e',
    warning: '#f59e0b',
    textPrimary: 'rgba(0,0,0,0.88)',
    textSecondary: 'rgba(0,0,0,0.55)',
    textTertiary: 'rgba(0,0,0,0.32)',
    textOnAccent: '#fff',
    bodyBg: '#f5f5fa',
    ambientA: 'rgba(100,140,240,0.06)',
    ambientB: 'rgba(160,100,240,0.04)',
  },
  'light-ocean': {
    label: 'Light Ocean',
    emoji: '\u{1F3D6}',
    agentEmoji: '\u{1F42C}',
    glassBg: 'rgba(240,248,255,0.88)',
    glassBgStrong: 'rgba(245,252,255,0.93)',
    glassSidebar: 'rgba(235,245,252,0.90)',
    glassElevated: 'rgba(248,252,255,0.82)',
    glassInput: 'rgba(0,40,80,0.04)',
    glassInputHover: 'rgba(0,40,80,0.07)',
    borderHairline: 'rgba(0,50,100,0.08)',
    borderSubtle: 'rgba(0,50,100,0.14)',
    borderFocus: 'rgba(20,140,210,0.5)',
    accent: '#0891b2',
    accentHover: '#0e7490',
    accentMuted: 'rgba(8,145,178,0.12)',
    accentGlow: 'rgba(8,145,178,0.20)',
    danger: '#dc2626',
    dangerMuted: 'rgba(220,38,38,0.12)',
    success: '#16a34a',
    warning: '#d97706',
    textPrimary: 'rgba(0,20,40,0.88)',
    textSecondary: 'rgba(0,20,40,0.55)',
    textTertiary: 'rgba(0,20,40,0.32)',
    textOnAccent: '#fff',
    bodyBg: '#eef6fb',
    ambientA: 'rgba(60,160,220,0.06)',
    ambientB: 'rgba(40,120,200,0.04)',
  },
  'light-rose': {
    label: 'Light Rose',
    emoji: '\u{1F338}',
    agentEmoji: '\u{1F98B}',
    glassBg: 'rgba(255,245,248,0.88)',
    glassBgStrong: 'rgba(255,248,252,0.93)',
    glassSidebar: 'rgba(252,240,245,0.90)',
    glassElevated: 'rgba(255,250,252,0.82)',
    glassInput: 'rgba(80,0,40,0.04)',
    glassInputHover: 'rgba(80,0,40,0.07)',
    borderHairline: 'rgba(100,0,50,0.08)',
    borderSubtle: 'rgba(100,0,50,0.14)',
    borderFocus: 'rgba(220,80,140,0.5)',
    accent: '#e11d78',
    accentHover: '#be185d',
    accentMuted: 'rgba(225,29,120,0.12)',
    accentGlow: 'rgba(225,29,120,0.20)',
    danger: '#dc2626',
    dangerMuted: 'rgba(220,38,38,0.12)',
    success: '#16a34a',
    warning: '#d97706',
    textPrimary: 'rgba(40,0,20,0.88)',
    textSecondary: 'rgba(40,0,20,0.55)',
    textTertiary: 'rgba(40,0,20,0.32)',
    textOnAccent: '#fff',
    bodyBg: '#fdf2f6',
    ambientA: 'rgba(220,80,140,0.06)',
    ambientB: 'rgba(200,60,120,0.04)',
  },
}

/**
 * Auto-generates a light variant from any dark theme tokens.
 */
export function generateLightVariant(t: ThemeTokens): ThemeTokens {
  return {
    ...t,
    glassBg: 'rgba(255,255,255,0.85)',
    glassBgStrong: 'rgba(255,255,255,0.92)',
    glassSidebar: 'rgba(245,245,250,0.90)',
    glassElevated: 'rgba(255,255,255,0.80)',
    glassInput: 'rgba(0,0,0,0.04)',
    glassInputHover: 'rgba(0,0,0,0.07)',
    borderHairline: 'rgba(0,0,0,0.08)',
    borderSubtle: 'rgba(0,0,0,0.14)',
    borderFocus: t.borderFocus,
    accent: t.accent,
    accentHover: t.accentHover,
    accentMuted: t.accentMuted.replace(/0\.\d+\)$/, '0.12)'),
    accentGlow: t.accentGlow.replace(/0\.\d+\)$/, '0.20)'),
    textPrimary: 'rgba(0,0,0,0.88)',
    textSecondary: 'rgba(0,0,0,0.55)',
    textTertiary: 'rgba(0,0,0,0.32)',
    textOnAccent: '#fff',
    bodyBg: '#f5f5fa',
    ambientA: t.ambientA.replace(/0\.\d+\)$/, '0.06)'),
    ambientB: t.ambientB.replace(/0\.\d+\)$/, '0.04)'),
  }
}

function applyTokens(t: ThemeTokens): void {
  const s = document.documentElement.style
  s.setProperty('--glass-bg', t.glassBg)
  s.setProperty('--glass-bg-strong', t.glassBgStrong)
  s.setProperty('--glass-sidebar', t.glassSidebar)
  s.setProperty('--glass-elevated', t.glassElevated)
  s.setProperty('--glass-input', t.glassInput)
  s.setProperty('--glass-input-hover', t.glassInputHover)
  s.setProperty('--border-hairline', t.borderHairline)
  s.setProperty('--border-subtle', t.borderSubtle)
  s.setProperty('--border-focus', t.borderFocus)
  s.setProperty('--accent', t.accent)
  s.setProperty('--accent-hover', t.accentHover)
  s.setProperty('--accent-muted', t.accentMuted)
  s.setProperty('--accent-glow', t.accentGlow)
  s.setProperty('--danger', t.danger)
  s.setProperty('--danger-muted', t.dangerMuted)
  s.setProperty('--success', t.success)
  s.setProperty('--warning', t.warning)
  s.setProperty('--text-primary', t.textPrimary)
  s.setProperty('--text-secondary', t.textSecondary)
  s.setProperty('--text-tertiary', t.textTertiary)
  s.setProperty('--text-on-accent', t.textOnAccent)
  s.setProperty('--body-bg', t.bodyBg)
  document.body.style.background = t.bodyBg
  document.documentElement.style.background = t.bodyBg
}

export function applyTheme(name: ThemeName, darkMode = true): void {
  const t = THEMES[name]
  if (!t) return

  const isNativeLight = name.startsWith('light')
  const useLight = !darkMode && !isNativeLight

  const tokens = useLight ? generateLightVariant(t) : t
  applyTokens(tokens)

  const isLight = isNativeLight || useLight
  document.documentElement.style.setProperty('color-scheme', isLight ? 'light' : 'dark')
  document.body.classList.toggle('theme-light', isLight)
  document.body.classList.toggle('theme-cyber', name === 'cyber')
}

// Base dark themes (light variants auto-generated via toggle)
export const THEME_NAMES: ThemeName[] = [
  'glass', 'forest', 'ocean', 'ember', 'midnight',
  'slate', 'sand', 'rose', 'cyber', 'classic',
  'light', 'light-ocean', 'light-rose'
]

// Themes shown in the picker (excludes dedicated light themes)
export const BASE_THEME_NAMES: ThemeName[] = [
  'glass', 'forest', 'ocean', 'ember', 'midnight',
  'slate', 'sand', 'rose', 'cyber', 'classic',
]
