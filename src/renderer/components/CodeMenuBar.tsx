import React, { useMemo, useState, useEffect } from 'react'

interface CodeMenuBarProps {
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
}

const MENU_ITEMS = ['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Help'] as const

export default function CodeMenuBar({
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
}: CodeMenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)

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
        <span className="coding-ai-status">AI controls moved to the right pane.</span>
      </div>
    </div>
  )
}
