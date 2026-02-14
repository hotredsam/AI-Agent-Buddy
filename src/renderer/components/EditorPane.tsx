import React, { useMemo, useEffect, useCallback, useState, useRef } from 'react'
import Editor, { loader } from '@monaco-editor/react'
import type * as monaco from 'monaco-editor'

export interface EditorTab {
  id: string
  filePath: string | null
  name: string
  content: string
  language: string
  savedContent: string
}

export interface EditorActions {
  insertAtCursor: (text: string) => void
  replaceSelection: (text: string) => void
  getSelection: () => string
  getCursorPosition: () => { line: number; column: number }
  getFullContent: () => string
}

interface EditorPaneProps {
  tabs: EditorTab[]
  activeTabId: string | null
  onSelectTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onRenameTab?: (tabId: string, name: string) => void
  onContentChange: (content: string) => void
  onSave: () => void
  onNewFile?: () => void
  onOpenFile?: () => void
  onOpenFolder?: () => void
  onOpenRecent?: () => void
  recentFiles?: string[]
  onOpenRecentFile?: (path: string) => void
  onEditorReady?: (actions: EditorActions) => void
}

const MONACO_LANG_MAP: Record<string, string> = {
  TypeScript: 'typescript',
  JavaScript: 'javascript',
  Python: 'python',
  Rust: 'rust',
  Go: 'go',
  Java: 'java',
  C: 'c',
  'C++': 'cpp',
  'C#': 'csharp',
  Ruby: 'ruby',
  PHP: 'php',
  Swift: 'swift',
  HTML: 'html',
  CSS: 'css',
  SCSS: 'scss',
  JSON: 'json',
  YAML: 'yaml',
  XML: 'xml',
  Markdown: 'markdown',
  SQL: 'sql',
  Shell: 'shell',
  Bash: 'shell',
  PowerShell: 'powershell',
}

let monacoThemeReady = false

function ensureMonacoTheme(): void {
  if (monacoThemeReady) return

  loader.init().then((monaco) => {
    if (monacoThemeReady) return
    monaco.editor.defineTheme('ai-agent-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#0c0c14',
        'editor.foreground': '#e8e8ec',
        'editor.lineHighlightBackground': '#1c1c2340',
        'editor.selectionBackground': '#6eaaff30',
        'editorCursor.foreground': '#6eaaff',
        'editorLineNumber.foreground': '#ffffff32',
        'editorLineNumber.activeForeground': '#ffffff55',
      },
    })
    monacoThemeReady = true
  }).catch(() => {
    // Monaco may fail to initialize in very early render; retry on next mount.
  })
}

export default function EditorPane({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onRenameTab,
  onContentChange,
  onSave,
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onOpenRecent,
  recentFiles = [],
  onOpenRecentFile,
  onEditorReady,
}: EditorPaneProps) {
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  useEffect(() => {
    ensureMonacoTheme()
  }, [])

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) || null,
    [tabs, activeTabId]
  )

  const handleSave = useCallback(() => {
    onSave()
  }, [onSave])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  if (!activeTab) {
    return (
      <div className="editor-pane">
        <div className="editor-welcome">
          <div className="editor-welcome-card">
            <div className="editor-welcome-left">
              <h2>AI Agent IDE</h2>
              <p className="editor-welcome-sub">Editing evolved with local and cloud intelligence.</p>
              
              <div className="welcome-section">
                <h3>Start</h3>
                <div className="welcome-links">
                  <button onClick={onNewFile}>
                    <span className="icon">&#x1F4C4;</span>
                    New File...
                  </button>
                  <button onClick={onOpenFile}>
                    <span className="icon">&#x1F4C2;</span>
                    Open File...
                  </button>
                  <button onClick={onOpenFolder}>
                    <span className="icon">&#x1F4C1;</span>
                    Open Folder...
                  </button>
                </div>
              </div>

              <div className="welcome-section">
                <h3>Recent</h3>
                <div className="welcome-recent-list">
                  {recentFiles.length === 0 ? (
                    <span className="recent-empty">No recent files</span>
                  ) : (
                    recentFiles.map(path => (
                      <button key={path} className="recent-item" onClick={() => onOpenRecentFile?.(path)}>
                        <span className="recent-name">{path.split(/[\\/]/).pop()}</span>
                        <span className="recent-path">{path}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="editor-welcome-right">
              <div className="welcome-section">
                <h3>Help</h3>
                <div className="welcome-links">
                  <button onClick={onOpenFile}>
                    <span className="icon">&#x2318;</span>
                    Go to File (Ctrl+P)
                  </button>
                  <button onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', ctrlKey: true }))}>
                    <span className="icon">&#x2699;</span>
                    Settings (Ctrl+,)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const monacoLanguage = MONACO_LANG_MAP[activeTab.language] || 'plaintext'
  const isModified = activeTab.content !== activeTab.savedContent

  return (
    <div className="editor-pane">
      <div className="editor-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`editor-tab ${tab.id === activeTab.id ? 'active' : ''}`}
            onClick={() => onSelectTab(tab.id)}
            title={tab.filePath || tab.name}
          >
            {renamingTabId === tab.id ? (
              <input
                className="editor-tab-rename"
                value={renameValue}
                autoFocus
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => {
                  if (onRenameTab && renameValue.trim()) {
                    onRenameTab(tab.id, renameValue.trim())
                  }
                  setRenamingTabId(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (onRenameTab && renameValue.trim()) {
                      onRenameTab(tab.id, renameValue.trim())
                    }
                    setRenamingTabId(null)
                  }
                  if (e.key === 'Escape') {
                    setRenamingTabId(null)
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="editor-tab-name"
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  setRenamingTabId(tab.id)
                  setRenameValue(tab.name)
                }}
              >
                {tab.name}
              </span>
            )}
            {tab.content !== tab.savedContent && <span className="editor-tab-dot">●</span>}
            <span
              className="editor-tab-close"
              onClick={(e) => {
                e.stopPropagation()
                onCloseTab(tab.id)
              }}
              role="button"
              aria-label={`Close ${tab.name}`}
            >
              ×
            </span>
          </button>
        ))}
      </div>

      <div className="editor-topbar">
        <div className="editor-topbar-left">
          <span className="editor-filename" title={activeTab.filePath || activeTab.name}>
            {activeTab.name}
          </span>
          {isModified && (
            <span className="editor-modified-indicator" title="Unsaved changes">
              Modified
            </span>
          )}
        </div>
        <div className="editor-topbar-right">
          {onOpenFile && (
            <button className="file-open-btn" onClick={onOpenFile} title="Open File (Ctrl+O)">
              Open
            </button>
          )}
          {activeTab.language && (
            <span className="editor-language-badge">{activeTab.language}</span>
          )}
          <button className="editor-save-btn" onClick={handleSave} title="Save (Ctrl+S)">
            Save
          </button>
        </div>
      </div>

      <div className="editor-monaco">
        <Editor
          height="100%"
          language={monacoLanguage}
          value={activeTab.content}
          onChange={(value) => onContentChange(value || '')}
          theme="ai-agent-dark"
          options={{
            minimap: { enabled: true },
            fontSize: 13,
            fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            tabSize: 2,
            insertSpaces: true,
            renderWhitespace: 'selection',
          }}
          onMount={(editor, monacoInstance) => {
            editorRef.current = editor
            editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
              handleSave()
            })
            if (onEditorReady) {
              onEditorReady({
                insertAtCursor: (text: string) => {
                  const position = editor.getPosition()
                  if (!position) return
                  editor.executeEdits('ai-inject', [{
                    range: new monacoInstance.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                    text,
                    forceMoveMarkers: true,
                  }])
                },
                replaceSelection: (text: string) => {
                  const selection = editor.getSelection()
                  if (!selection) return
                  editor.executeEdits('ai-inject', [{
                    range: selection,
                    text,
                    forceMoveMarkers: true,
                  }])
                },
                getSelection: () => {
                  const selection = editor.getSelection()
                  if (!selection) return ''
                  return editor.getModel()?.getValueInRange(selection) || ''
                },
                getCursorPosition: () => {
                  const pos = editor.getPosition()
                  return { line: pos?.lineNumber || 1, column: pos?.column || 1 }
                },
                getFullContent: () => {
                  return editor.getModel()?.getValue() || ''
                },
              })
            }
          }}
        />
      </div>
    </div>
  )
}
