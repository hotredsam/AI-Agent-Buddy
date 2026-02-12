import React, { useState, useEffect, useRef, useCallback } from 'react'

interface EditorPaneProps {
  filePath: string | null
  content: string
  onContentChange: (content: string) => void
  onSave: () => void
  language: string
  onOpenFile?: () => void
}

/**
 * Extracts the filename from a full file path.
 * Returns 'Untitled' when no path is provided.
 */
function extractFilename(filePath: string | null): string {
  if (!filePath) return 'Untitled'
  const separator = filePath.includes('\\') ? '\\' : '/'
  const parts = filePath.split(separator)
  return parts[parts.length - 1] || 'Untitled'
}

export default function EditorPane({
  filePath,
  content,
  onContentChange,
  onSave,
  language,
  onOpenFile,
}: EditorPaneProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [savedContent, setSavedContent] = useState(content)
  const isModified = content !== savedContent

  // Sync savedContent baseline whenever the file path changes (new file opened)
  useEffect(() => {
    setSavedContent(content)
  }, [filePath])

  // Reset saved baseline after a successful save
  const handleSave = useCallback(() => {
    onSave()
    setSavedContent(content)
  }, [onSave, content])

  // Global Ctrl+S keyboard shortcut
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

  // Handle tab key to insert 2 spaces instead of changing focus
  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault()
        const textarea = textareaRef.current
        if (!textarea) return

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const value = textarea.value
        const indent = '  '

        const updated = value.substring(0, start) + indent + value.substring(end)
        onContentChange(updated)

        // Restore cursor position after React re-renders
        requestAnimationFrame(() => {
          textarea.selectionStart = start + indent.length
          textarea.selectionEnd = start + indent.length
        })
      }
    },
    [onContentChange],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onContentChange(e.target.value)
    },
    [onContentChange],
  )

  const filename = extractFilename(filePath)

  // Empty state when no file is open
  if (!filePath) {
    return (
      <div className="editor-pane">
        <div className="editor-topbar">
          <div className="editor-topbar-left">
            <span className="editor-filename">No file open</span>
          </div>
          <div className="editor-topbar-right">
            {onOpenFile && (
              <button className="editor-save-btn" onClick={onOpenFile} title="Open File (Ctrl+O)">
                Open File
              </button>
            )}
          </div>
        </div>
        <div className="editor-empty">
          <span className="editor-empty-icon">{'\u{1F4DD}'}</span>
          <p>Open a file to start editing</p>
          <span className="sub">Ctrl+O to open | AI can write code here</span>
        </div>
      </div>
    )
  }

  return (
    <div className="editor-pane">
      <div className="editor-topbar">
        <div className="editor-topbar-left">
          <span className="editor-filename" title={filePath || undefined}>
            {filename}
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
          {language && (
            <span className="editor-language-badge">{language}</span>
          )}
          <button
            className="editor-save-btn"
            onClick={handleSave}
            title="Save (Ctrl+S)"
          >
            Save
          </button>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        className="editor-textarea"
        value={content}
        onChange={handleChange}
        onKeyDown={handleTextareaKeyDown}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        data-gramm="false"
      />
    </div>
  )
}
