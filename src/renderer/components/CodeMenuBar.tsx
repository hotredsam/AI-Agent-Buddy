import React, { useMemo, useState, useEffect } from 'react'
import type { Settings } from '../types'

interface CodeMenuBarProps {
  settings: Settings
  onSaveSettings: (next: Settings) => void
  showExplorer: boolean
  showTerminal: boolean
  onToggleExplorer: () => void
  onToggleTerminal: () => void
  onNewFile: () => void
  onOpenFile: () => void
  onOpenFolder: () => void
  onOpenRecent: () => void
  onSaveFile: () => void
  onCloseTab: () => void
  onRunAI: (
    prompt: string,
    provider: NonNullable<Settings['activeProvider']>,
    model: string,
    mode: 'coding' | 'plan' | 'build' | 'bugfix'
  ) => void
  aiBusy?: boolean
  aiStatus?: string
  modelOptions?: string[]
}

const MENU_ITEMS = ['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Help'] as const

export default function CodeMenuBar({
  settings,
  onSaveSettings,
  showExplorer,
  showTerminal,
  onToggleExplorer,
  onToggleTerminal,
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onOpenRecent,
  onSaveFile,
  onCloseTab,
  onRunAI,
  aiBusy = false,
  aiStatus = '',
  modelOptions = [],
}: CodeMenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState<'coding' | 'plan' | 'build' | 'bugfix'>('coding')
  const provider = (settings.codingProvider || settings.activeProvider || 'ollama') as NonNullable<Settings['activeProvider']>
  const model = settings.codingModel || settings.modelName

  useEffect(() => {
    const closeMenu = () => setOpenMenu(null)
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [])

  const menuActions = useMemo(() => ({
    File: [
      { label: 'New File', action: onNewFile },
      { label: 'Open File...', action: onOpenFile },
      { label: 'Open Folder...', action: onOpenFolder },
      { label: 'Open Recent...', action: onOpenRecent },
      { label: 'Quick Open... (Ctrl+P)', action: onOpenFile },
      { label: 'Save', action: onSaveFile },
      { label: 'Close Editor', action: onCloseTab },
    ],
    Edit: [
      { label: 'Undo (Ctrl+Z)', action: () => document.execCommand('undo') },
      { label: 'Redo (Ctrl+Y)', action: () => document.execCommand('redo') },
      { label: 'Cut', action: () => document.execCommand('cut') },
      { label: 'Copy', action: () => document.execCommand('copy') },
      { label: 'Paste', action: () => document.execCommand('paste') },
    ],
    Selection: [
      { label: 'Select All (Ctrl+A)', action: () => document.execCommand('selectAll') },
    ],
    View: [
      { label: showExplorer ? 'Hide Explorer' : 'Show Explorer', action: onToggleExplorer },
      { label: showTerminal ? 'Hide Terminal' : 'Show Terminal', action: onToggleTerminal },
    ],
    Go: [
      { label: 'Go to Chat (Ctrl+1)', action: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true })) },
      { label: 'Go to Code (Ctrl+2)', action: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', ctrlKey: true })) },
      { label: 'Go to Files (Ctrl+3)', action: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: '3', ctrlKey: true })) },
    ],
    Run: [
      { label: 'Toggle Terminal Panel', action: onToggleTerminal },
    ],
    Terminal: [
      { label: 'Toggle Terminal Panel', action: onToggleTerminal },
    ],
    Help: [
      { label: 'Open Settings (Ctrl+,)', action: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', ctrlKey: true })) },
    ],
  }), [
    onNewFile,
    onOpenFile,
    onOpenFolder,
    onOpenRecent,
    onSaveFile,
    onCloseTab,
    showExplorer,
    showTerminal,
    onToggleExplorer,
    onToggleTerminal,
  ])

  return (
    <div className="code-menubar">
      <div className="code-menubar-left">
        {MENU_ITEMS.map((name) => (
          <div className="code-menu-group" key={name}>
            <button
              className={`code-menu-btn ${openMenu === name ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                setOpenMenu((prev) => prev === name ? null : name)
              }}
            >
              {name}
            </button>
            {openMenu === name && (
              <div className="code-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                {menuActions[name].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    item.action()
                    setOpenMenu(null)
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="code-menubar-right">
        <span className="coding-ai-label">Coding AI</span>
        <select
          className="coding-ai-select"
          value={mode}
          onChange={(e) => setMode(e.target.value as any)}
        >
          <option value="coding">Code</option>
          <option value="plan">Plan</option>
          <option value="build">Build</option>
          <option value="bugfix">Bug Fix</option>
        </select>
        <select
          className="coding-ai-select"
          value={provider}
          onChange={(e) => onSaveSettings({ ...settings, codingProvider: e.target.value as any })}
        >
          <option value="ollama">Ollama</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="google">Google</option>
          <option value="groq">Groq</option>
        </select>
        <input
          className="coding-ai-model"
          value={model}
          onChange={(e) => onSaveSettings({ ...settings, codingModel: e.target.value })}
          placeholder="coding model"
          list="coding-model-options"
        />
        {modelOptions.length > 0 && (
          <datalist id="coding-model-options">
            {modelOptions.map((m) => <option key={m} value={m} />)}
          </datalist>
        )}
        <input
          className="coding-ai-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what to plan/build/fix..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && prompt.trim()) {
              onRunAI(prompt.trim(), provider, model, mode)
              setPrompt('')
            }
          }}
        />
        <button
          disabled={aiBusy}
          className={`coding-ai-run ${aiBusy ? 'busy' : ''}`}
          onClick={() => {
            if (!prompt.trim()) return
            onRunAI(prompt.trim(), provider, model, mode)
            setPrompt('')
          }}
        >
          {aiBusy ? 'Working...' : 'Apply'}
        </button>
        {aiStatus && <span className="coding-ai-status">{aiStatus}</span>}
      </div>
    </div>
  )
}
