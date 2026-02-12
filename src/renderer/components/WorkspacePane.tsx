import React, { useState, useEffect, useCallback } from 'react'
import type { UserFile } from '../types'

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

export default function WorkspacePane() {
  const [files, setFiles] = useState<UserFile[]>([])
  const [loading, setLoading] = useState(true)
  const [dragOver, setDragOver] = useState(false)

  const loadFiles = useCallback(async () => {
    try {
      const list = await window.electronAPI.listFiles()
      setFiles(list)
    } catch (err) {
      console.error('Failed to list files:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadFiles() }, [loadFiles])

  const handleImport = async () => {
    const file = await window.electronAPI.importFile()
    if (file) {
      setFiles(prev => [file, ...prev])
    }
  }

  const handleDelete = async (fileName: string) => {
    const ok = await window.electronAPI.deleteFile(fileName)
    if (ok) {
      setFiles(prev => prev.filter(f => f.name !== fileName))
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
        // Try Electron's File.path first (works when sandbox: false + no contextIsolation quirks)
        const filePath = (file as any).path
        if (filePath) {
          const imported = await window.electronAPI.importFileByPath(filePath)
          if (imported) {
            setFiles(prev => [imported, ...prev.filter(f => f.name !== imported.name)])
            continue
          }
        }
        // Fallback: read file contents via FileReader API and send buffer over IPC
        const buffer = await file.arrayBuffer()
        const imported = await window.electronAPI.importFileByBuffer(file.name, buffer)
        if (imported) {
          setFiles(prev => [imported, ...prev.filter(f => f.name !== imported.name)])
        }
      } catch (err) {
        console.error('Failed to import dropped file:', err)
      }
    }
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
              <button
                className="file-delete-btn"
                onClick={() => handleDelete(file.name)}
                title="Delete"
              >
                &#x2715;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
