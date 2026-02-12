import React, { useState, useEffect, useCallback } from 'react'
import type { UserFile, UserFileInfo } from '../types'

interface WorkspacePaneProps {
  onOpenInEditor?: (file: UserFile) => void | Promise<void>
  onNotify?: (text: string, type?: 'error' | 'warning' | 'success') => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

function fileIcon(type: string): string {
  const icons: Record<string, string> = {
    '.pdf': '\u{1F4C4}',
    '.doc': '\u{1F4C4}', '.docx': '\u{1F4C4}',
    '.txt': '\u{1F4DD}', '.md': '\u{1F4DD}',
    '.png': '\u{1F5BC}', '.jpg': '\u{1F5BC}', '.jpeg': '\u{1F5BC}', '.gif': '\u{1F5BC}', '.webp': '\u{1F5BC}', '.svg': '\u{1F5BC}',
    '.mp3': '\u{1F3B5}', '.wav': '\u{1F3B5}', '.ogg': '\u{1F3B5}', '.flac': '\u{1F3B5}',
    '.mp4': '\u{1F3AC}', '.mkv': '\u{1F3AC}', '.avi': '\u{1F3AC}',
    '.zip': '\u{1F4E6}', '.rar': '\u{1F4E6}', '.7z': '\u{1F4E6}', '.tar': '\u{1F4E6}',
    '.json': '\u{1F4CB}', '.csv': '\u{1F4CB}', '.xml': '\u{1F4CB}',
    '.py': '\u{1F40D}', '.js': '\u{26A1}', '.ts': '\u{26A1}', '.html': '\u{1F310}', '.css': '\u{1F3A8}',
  }
  return icons[type] || '\u{1F4CE}'
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

export default function WorkspacePane({ onOpenInEditor, onNotify }: WorkspacePaneProps) {
  const [files, setFiles] = useState<UserFile[]>([])
  const [loading, setLoading] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [detailsFile, setDetailsFile] = useState<UserFileInfo | null>(null)

  const loadFiles = useCallback(async () => {
    try {
      const list = await window.electronAPI.listFiles()
      setFiles(list)
    } catch (err) {
      console.error('Failed to list files:', err)
      onNotify?.('Failed to load library files.')
    } finally {
      setLoading(false)
    }
  }, [onNotify])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  useEffect(() => {
    const closeMenu = () => setOpenMenu(null)
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [])

  const upsertFile = useCallback((file: UserFile | null) => {
    if (!file) return
    setFiles((prev) => [file, ...prev.filter((f) => f.name !== file.name)])
  }, [])

  const handleImport = async () => {
    const file = await window.electronAPI.importFile()
    if (file) {
      upsertFile(file)
    }
  }

  const handleDelete = async (fileName: string) => {
    if (!confirm(`Delete "${fileName}"? This cannot be undone.`)) return
    const ok = await window.electronAPI.deleteFile(fileName)
    if (ok) {
      setFiles((prev) => prev.filter((f) => f.name !== fileName))
      onNotify?.(`Deleted "${fileName}".`, 'success')
    } else {
      onNotify?.(`Failed to delete "${fileName}".`)
    }
  }

  const handleOpenFolder = () => {
    window.electronAPI.openFilesFolder()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    const droppedFiles = e.dataTransfer.files
    if (!droppedFiles || droppedFiles.length === 0) return

    for (let i = 0; i < droppedFiles.length; i++) {
      const file = droppedFiles[i]
      try {
        const filePath = (file as any).path
        if (filePath) {
          const imported = await window.electronAPI.importFileByPath(filePath)
          if (imported) {
            upsertFile(imported)
            continue
          }
        }

        const buffer = await file.arrayBuffer()
        const imported = await window.electronAPI.importFileByBuffer(file.name, buffer)
        if (imported) {
          upsertFile(imported)
        }
      } catch (err) {
        console.error('Failed to import dropped file:', err)
      }
    }
  }

  const handleSaveAs = async (file: UserFile) => {
    const ok = await window.electronAPI.saveFileAs(file.path)
    if (!ok) onNotify?.(`Save As cancelled or failed for "${file.name}".`, 'warning')
  }

  const handleRename = async (file: UserFile) => {
    const nextName = prompt('Rename file to:', file.name)?.trim()
    if (!nextName || nextName === file.name) return
    const renamed = await window.electronAPI.renameFile(file.name, nextName)
    if (renamed) {
      setFiles((prev) => prev.map((f) => (f.name === file.name ? renamed : f)))
      onNotify?.(`Renamed to "${nextName}".`, 'success')
    } else {
      onNotify?.('Rename failed.')
    }
  }

  const handleMove = async (file: UserFile) => {
    const moved = await window.electronAPI.moveFile(file.name)
    if (moved) {
      setFiles((prev) => prev.filter((f) => f.name !== file.name))
      onNotify?.(`Moved "${file.name}" to ${moved.path}.`, 'success')
    } else {
      onNotify?.('Move cancelled or failed.', 'warning')
    }
  }

  const handleDuplicate = async (file: UserFile) => {
    const parsed = file.name.lastIndexOf('.')
    const defaultName = parsed > 0
      ? `${file.name.slice(0, parsed)}_copy${file.name.slice(parsed)}`
      : `${file.name}_copy`
    const nextName = prompt('Duplicate as:', defaultName)?.trim()
    if (!nextName) return

    const duplicated = await window.electronAPI.duplicateFile(file.name, nextName)
    if (duplicated) {
      upsertFile(duplicated)
      onNotify?.(`Duplicated as "${nextName}".`, 'success')
    } else {
      onNotify?.('Duplicate failed.')
    }
  }

  const handleCopyPath = async (file: UserFile) => {
    try {
      await navigator.clipboard.writeText(file.path)
      onNotify?.('File path copied.', 'success')
    } catch {
      onNotify?.('Failed to copy path.')
    }
  }

  const handleDetails = async (file: UserFile) => {
    const info = await window.electronAPI.getFileInfo(file.name)
    if (info) {
      setDetailsFile(info)
    } else {
      onNotify?.('Could not read file details.')
    }
  }

  const handleShowInExplorer = async (file: UserFile) => {
    const ok = await window.electronAPI.showInExplorer(file.path)
    if (!ok) onNotify?.('Failed to open in Explorer.')
  }

  const handleOpenExternal = async (file: UserFile) => {
    const ok = await window.electronAPI.openExternal(file.path)
    if (!ok) onNotify?.('Failed to open with external app.')
  }

  return (
    <div
      className="workspace-pane-files"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="files-header">
        <h2>Library</h2>
        <div className="files-header-actions">
          <button className="files-btn" onClick={handleImport} title="Import file">
            + Import
          </button>
          <button className="files-btn secondary" onClick={handleOpenFolder} title="Open folder">
            Open Folder
          </button>
        </div>
      </div>

      {loading ? (
        <div className="files-empty">Loading...</div>
      ) : files.length === 0 ? (
        <div className={`files-empty ${dragOver ? 'drag-over' : ''}`}>
          <span className="files-empty-icon">{'\u{1F4C2}'}</span>
          <p>No files yet</p>
          <span className="files-empty-sub">Drag files here or click "Import"</span>
        </div>
      ) : (
        <div className="files-list">
          {files.map((file) => (
            <div key={file.name} className="file-item">
              <span className="file-icon">{fileIcon(file.type)}</span>
              <div className="file-info">
                <span className="file-name">{file.name}</span>
                <span className="file-meta">{formatFileSize(file.size)}</span>
              </div>
              <div className="file-actions">
                <button
                  className="file-menu-btn"
                  title="File actions"
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenMenu((prev) => (prev === file.name ? null : file.name))
                  }}
                >
                  ⋯
                </button>
                {openMenu === file.name && (
                  <div className="file-action-menu" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { handleSaveAs(file); setOpenMenu(null) }}>Download</button>
                    <button onClick={() => { onOpenInEditor?.(file); setOpenMenu(null) }}>Edit</button>
                    <button onClick={() => { handleRename(file); setOpenMenu(null) }}>Rename</button>
                    <button onClick={() => { handleMove(file); setOpenMenu(null) }}>Move</button>
                    <button onClick={() => { handleDuplicate(file); setOpenMenu(null) }}>Duplicate</button>
                    <button onClick={() => { handleCopyPath(file); setOpenMenu(null) }}>Copy Path</button>
                    <button onClick={() => { handleDetails(file); setOpenMenu(null) }}>View Details</button>
                    <button onClick={() => { handleShowInExplorer(file); setOpenMenu(null) }}>Open in Explorer</button>
                    <button onClick={() => { handleOpenExternal(file); setOpenMenu(null) }}>Open Externally</button>
                    <button className="danger" onClick={() => { handleDelete(file.name); setOpenMenu(null) }}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {detailsFile && (
        <div className="file-details-overlay" onClick={() => setDetailsFile(null)}>
          <div className="file-details-modal" onClick={(e) => e.stopPropagation()}>
            <h3>File Details</h3>
            <div className="file-details-row"><span>Name</span><span>{detailsFile.name}</span></div>
            <div className="file-details-row"><span>Type</span><span>{detailsFile.type || 'unknown'}</span></div>
            <div className="file-details-row"><span>Size</span><span>{formatFileSize(detailsFile.size)}</span></div>
            <div className="file-details-row"><span>Created</span><span>{formatDate(detailsFile.createdAt)}</span></div>
            <div className="file-details-row"><span>Modified</span><span>{formatDate(detailsFile.modifiedAt)}</span></div>
            <div className="file-details-path" title={detailsFile.path}>{detailsFile.path}</div>
            <button className="files-btn secondary" onClick={() => setDetailsFile(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
