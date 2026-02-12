import React, { useMemo, useEffect, useCallback } from 'react'
import Editor, { loader } from '@monaco-editor/react'

export interface EditorTab {
  id: string
  filePath: string | null
  name: string
  content: string
  language: string
  savedContent: string
}

interface EditorPaneProps {
  tabs: EditorTab[]
  activeTabId: string | null
  onSelectTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onContentChange: (content: string) => void
  onSave: () => void
  onNewFile?: () => void
  onOpenFile?: () => void
  onOpenFolder?: () => void
  onOpenRecent?: () => void
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
  onContentChange,
  onSave,
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onOpenRecent,
}: EditorPaneProps) {
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
            <h2>Start Coding</h2>
            <p className="editor-welcome-sub">Open a project or file to begin.</p>
            <div className="editor-welcome-actions">
              <button className="editor-save-btn" onClick={onNewFile}>New File</button>
              <button className="editor-save-btn" onClick={onOpenFile}>Open File...</button>
              <button className="editor-save-btn" onClick={onOpenFolder}>Open Folder...</button>
              <button className="editor-save-btn" onClick={onOpenRecent}>Open Recent</button>
            </div>
            <div className="editor-welcome-links">
              <button onClick={onOpenFile}>Go to File (Ctrl+O)</button>
              <button onClick={onOpenFolder}>Open Workspace Folder</button>
              <button onClick={onNewFile}>Create Untitled File</button>
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
            <span className="editor-tab-name">{tab.name}</span>
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
          onMount={(editor, monaco) => {
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
              handleSave()
            })
          }}
        />
      </div>
    </div>
  )
}
