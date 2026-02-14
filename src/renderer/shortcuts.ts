/**
 * Centralized Keyboard Shortcut Manager
 *
 * A singleton that maintains a registry of shortcut-to-action mappings,
 * handles keyboard events globally, and supports modifier + combo keys.
 *
 * Usage:
 *   import { shortcutManager, DEFAULT_SHORTCUTS } from './shortcuts'
 *   shortcutManager.register('Ctrl+B', 'toggle-sidebar', () => { ... })
 *   shortcutManager.unregister('toggle-sidebar')
 */

export interface ShortcutEntry {
  id: string
  keys: string
  label: string
}

interface RegisteredShortcut {
  id: string
  keys: string
  label: string
  handler: () => void
}

/**
 * Normalise a shortcut string into a canonical form for matching.
 * "Ctrl+Shift+P" -> "ctrl+shift+p"
 * Sorts modifiers so "Shift+Ctrl+P" equals "Ctrl+Shift+P".
 */
function normaliseKeys(keys: string): string {
  const parts = keys.toLowerCase().split('+').map((p) => p.trim())
  const modifiers: string[] = []
  const rest: string[] = []

  for (const part of parts) {
    if (part === 'ctrl' || part === 'shift' || part === 'alt' || part === 'meta') {
      modifiers.push(part)
    } else {
      rest.push(part)
    }
  }

  // Stable modifier order: alt, ctrl, meta, shift
  modifiers.sort()
  return [...modifiers, ...rest].join('+')
}

/**
 * Build the normalised key string from a live KeyboardEvent.
 */
function eventToKeys(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.altKey) parts.push('alt')
  if (e.ctrlKey || e.metaKey) parts.push('ctrl')
  if (e.metaKey && !e.ctrlKey) {
    // Already captured above — meta acts as ctrl on macOS
  }
  if (e.shiftKey) parts.push('shift')

  // Map the key value to a stable label
  let key = e.key.toLowerCase()

  // Normalise special keys
  if (key === ' ') key = 'space'
  if (key === '`') key = '`'
  if (key === 'escape') key = 'escape'

  // Ignore standalone modifier presses
  if (['control', 'shift', 'alt', 'meta'].includes(key)) return ''

  parts.sort()
  parts.push(key)
  return parts.join('+')
}

// Shortcuts that Monaco editor uses — we must avoid overriding these when
// the focus is inside a Monaco editor instance.
const MONACO_SHORTCUTS = new Set([
  'ctrl+s',       // Save (we handle at app level, but let Monaco see it too)
  'ctrl+z',       // Undo
  'ctrl+shift+z', // Redo
  'ctrl+y',       // Redo (alt)
  'ctrl+x',       // Cut
  'ctrl+c',       // Copy
  'ctrl+v',       // Paste
  'ctrl+a',       // Select all
  'ctrl+d',       // Add selection to next find match
  'ctrl+f',       // Find
  'ctrl+h',       // Replace
  'ctrl+g',       // Go to line
  'ctrl+shift+k', // Delete line
  'ctrl+/',       // Toggle comment
  'ctrl+shift+f', // Find in files
])

export class KeyboardShortcutManager {
  private shortcuts = new Map<string, RegisteredShortcut>()
  private idToNormKeys = new Map<string, string>()
  private listening = false

  private handleKeyDown = (e: KeyboardEvent): void => {
    const pressed = eventToKeys(e)
    if (!pressed) return

    // If focus is inside a Monaco editor, skip our shortcut if it conflicts
    const active = document.activeElement
    const inMonaco =
      active?.closest('.monaco-editor') !== null ||
      active?.classList.contains('inputarea') === true

    if (inMonaco && MONACO_SHORTCUTS.has(pressed)) {
      return // let Monaco handle it
    }

    const entry = this.shortcuts.get(pressed)
    if (!entry) return

    // Prevent browser default for registered shortcuts
    e.preventDefault()
    e.stopPropagation()
    entry.handler()
  }

  /**
   * Start listening for keyboard events on the window.
   * Safe to call multiple times — only attaches once.
   */
  start(): void {
    if (this.listening) return
    window.addEventListener('keydown', this.handleKeyDown, true)
    this.listening = true
  }

  /**
   * Stop listening and clear all registered shortcuts.
   */
  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown, true)
    this.shortcuts.clear()
    this.idToNormKeys.clear()
    this.listening = false
  }

  /**
   * Register a keyboard shortcut.
   * If the actionId was already registered it will be replaced.
   */
  register(keys: string, actionId: string, handler: () => void, label?: string): void {
    // Unregister previous binding for this action (if any)
    this.unregister(actionId)

    const norm = normaliseKeys(keys)
    this.shortcuts.set(norm, { id: actionId, keys, label: label || actionId, handler })
    this.idToNormKeys.set(actionId, norm)
  }

  /**
   * Remove a shortcut by its action id.
   */
  unregister(actionId: string): void {
    const norm = this.idToNormKeys.get(actionId)
    if (norm) {
      this.shortcuts.delete(norm)
      this.idToNormKeys.delete(actionId)
    }
  }

  /**
   * Return all currently registered shortcuts for display purposes.
   */
  getAll(): ShortcutEntry[] {
    const entries: ShortcutEntry[] = []
    for (const entry of this.shortcuts.values()) {
      entries.push({ id: entry.id, keys: entry.keys, label: entry.label })
    }
    return entries
  }

  /**
   * Check whether a given action id is currently registered.
   */
  has(actionId: string): boolean {
    return this.idToNormKeys.has(actionId)
  }
}

/** The singleton instance used throughout the app. */
export const shortcutManager = new KeyboardShortcutManager()

/** Default shortcuts shipped with the IDE. */
export const DEFAULT_SHORTCUTS: ShortcutEntry[] = [
  { id: 'toggle-sidebar',    keys: 'Ctrl+B',       label: 'Toggle Sidebar' },
  { id: 'new-conversation',  keys: 'Ctrl+N',       label: 'New Conversation' },
  { id: 'toggle-theme',      keys: 'Ctrl+Shift+T', label: 'Cycle Theme' },
  { id: 'command-palette',   keys: 'Ctrl+Shift+P', label: 'Command Palette' },
  { id: 'focus-chat',        keys: 'Ctrl+L',       label: 'Focus Chat Input' },
  { id: 'toggle-terminal',   keys: 'Ctrl+`',       label: 'Toggle Terminal' },
  { id: 'toggle-explorer',   keys: 'Ctrl+E',       label: 'Toggle File Explorer' },
  { id: 'switch-to-chat',    keys: 'Ctrl+1',       label: 'Switch to Chat View' },
  { id: 'switch-to-code',    keys: 'Ctrl+2',       label: 'Switch to Code View' },
  { id: 'switch-to-agents',  keys: 'Ctrl+3',       label: 'Switch to Agents View' },
  { id: 'close-tab',         keys: 'Ctrl+W',       label: 'Close Current Tab' },
  { id: 'new-project',       keys: 'Ctrl+Shift+N', label: 'New Project' },
  { id: 'focus-explorer',    keys: 'Ctrl+Shift+E', label: 'Focus Explorer' },
  { id: 'toggle-ai-pane',    keys: 'Ctrl+Shift+B', label: 'Toggle AI Pane' },
  { id: 'clear-chat',        keys: 'Ctrl+K',       label: 'Clear Chat' },
  { id: 'refresh-connection', keys: 'F5',           label: 'Refresh Connection' },
  { id: 'run-diagnostics',   keys: 'Ctrl+Shift+D', label: 'Run Diagnostics' },
]
