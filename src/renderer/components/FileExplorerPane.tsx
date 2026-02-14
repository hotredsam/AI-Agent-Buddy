import React, { useCallback, useMemo, useState, useEffect } from 'react'
import type { WorkspaceEntry } from '../types'

interface FileExplorerPaneProps {
  rootPath: string | null
  onRootPathChange: (rootPath: string | null) => void
  activeFilePath: string | null
  onOpenFile: (filePath: string) => void | Promise<void>
  onNotify?: (text: string, type?: 'error' | 'warning' | 'success') => void
}

function baseName(targetPath: string): string {
  const separator = targetPath.includes('\\') ? '\\' : '/'
  const parts = targetPath.split(separator)
  return parts[parts.length - 1] || targetPath
}

function folderName(rootPath: string | null): string {
  if (!rootPath) return ''
  return baseName(rootPath)
}

export default function FileExplorerPane({
  rootPath,
  onRootPathChange,
  activeFilePath,
  onOpenFile,
  onNotify,
}: FileExplorerPaneProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [entries, setEntries] = useState<Record<string, WorkspaceEntry[]>>({})
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    const close = () => setOpenMenuPath(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const loadFolder = useCallback(async (path: string) => {
    const list = await window.electronAPI.listWorkspaceFolder(path)
    setEntries((prev) => ({ ...prev, [path]: list }))
  }, [])

  const handleOpenFolder = useCallback(async () => {
    const picked = await window.electronAPI.pickWorkspaceFolder()
    if (!picked) return
    onRootPathChange(picked)
    await loadFolder(picked)
    setExpanded({ [picked]: true })
  }, [loadFolder, onRootPathChange])

  const toggleExpand = useCallback(async (path: string) => {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }))
    if (!entries[path]) {
      await loadFolder(path)
    }
  }, [entries, loadFolder])

  const refreshParent = useCallback(async (targetPath: string) => {
    const separator = targetPath.includes('\\') ? '\\' : '/'
    const parts = targetPath.split(separator)
    parts.pop()
    const parent = parts.join(separator)
    if (parent) {
      await loadFolder(parent)
    }
  }, [loadFolder])

  const createFile = useCallback(async (parentPath: string) => {
    const name = prompt('New file name:')
    if (!name?.trim()) return
    const ok = await window.electronAPI.createWorkspaceFile(parentPath, name.trim(), '')
    if (ok) {
      await loadFolder(parentPath)
    } else {
      onNotify?.('Failed to create file.')
    }
  }, [loadFolder, onNotify])

  const createFolder = useCallback(async (parentPath: string) => {
    const name = prompt('New folder name:')
    if (!name?.trim()) return
    const ok = await window.electronAPI.createWorkspaceFolder(parentPath, name.trim())
    if (ok) {
      await loadFolder(parentPath)
    } else {
      onNotify?.('Failed to create folder.')
    }
  }, [loadFolder, onNotify])

  const renamePath = useCallback(async (path: string) => {
    const currentName = baseName(path)
    const nextName = prompt('Rename to:', currentName)?.trim()
    if (!nextName || nextName === currentName) return
    const updated = await window.electronAPI.renameWorkspacePath(path, nextName)
    if (updated) {
      await refreshParent(updated)
      onNotify?.(`Renamed to "${nextName}".`, 'success')
    } else {
      onNotify?.('Rename failed.')
    }
  }, [onNotify, refreshParent])

  const deletePath = useCallback(async (path: string) => {
    const name = baseName(path)
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    const ok = await window.electronAPI.deleteWorkspacePath(path)
    if (ok) {
      await refreshParent(path)
      onNotify?.(`Deleted "${name}".`, 'success')
    } else {
      onNotify?.('Delete failed.')
    }
  }, [onNotify, refreshParent])

  const copyPath = useCallback(async (path: string) => {
    try {
      await navigator.clipboard.writeText(path)
      onNotify?.('Path copied.', 'success')
    } catch {
      onNotify?.('Failed to copy path.')
    }
  }, [onNotify])

  const renderFolderChildren = useCallback((folderPath: string, level: number): React.ReactNode => {
    const children = entries[folderPath] || []
    return children.map((entry) => {
      const isExpanded = !!expanded[entry.path]
      const isActive = !entry.isDirectory && activeFilePath === entry.path

      return (
        <div key={entry.path}>
          <div
            className={`explorer-item ${isActive ? 'active' : ''}`}
            style={{ paddingLeft: `${8 + level * 14}px` }}
            onDoubleClick={() => {
              if (!entry.isDirectory) {
                onOpenFile(entry.path)
              }
            }}
          >
            {entry.isDirectory ? (
              <button className="explorer-expand-btn" onClick={() => toggleExpand(entry.path)}>
                {isExpanded ? '▾' : '▸'}
              </button>
            ) : (
              <span className="explorer-file-spacer" />
            )}
            <span className="explorer-item-icon">{entry.isDirectory ? '\u{1F4C1}' : '\u{1F4C4}'}</span>
            <button
              className="explorer-item-name"
              onClick={() => {
                if (entry.isDirectory) {
                  toggleExpand(entry.path)
                } else {
                  onOpenFile(entry.path)
                }
              }}
              title={entry.path}
            >
              {entry.name}
            </button>
            <div className="explorer-item-actions">
              <button
                className="explorer-menu-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenMenuPath((prev) => (prev === entry.path ? null : entry.path))
                }}
              >
                ⋯
              </button>
              {openMenuPath === entry.path && (
                <div className="explorer-menu" onClick={(e) => e.stopPropagation()}>
                  {entry.isDirectory && (
                    <>
                      <button onClick={() => { createFile(entry.path); setOpenMenuPath(null) }}>New File</button>
                      <button onClick={() => { createFolder(entry.path); setOpenMenuPath(null) }}>New Folder</button>
                    </>
                  )}
                  {!entry.isDirectory && (
                    <button onClick={() => { onOpenFile(entry.path); setOpenMenuPath(null) }}>Open</button>
                  )}
                  <button onClick={() => { renamePath(entry.path); setOpenMenuPath(null) }}>Rename</button>
                  <button onClick={() => { copyPath(entry.path); setOpenMenuPath(null) }}>Copy Path</button>
                  <button onClick={() => { window.electronAPI.showInExplorer(entry.path); setOpenMenuPath(null) }}>
                    Reveal in Explorer
                  </button>
                  {!entry.isDirectory && (
                    <button onClick={() => { window.electronAPI.openExternal(entry.path); setOpenMenuPath(null) }}>
                      Open Externally
                    </button>
                  )}
                  <button className="danger" onClick={() => { deletePath(entry.path); setOpenMenuPath(null) }}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
          {entry.isDirectory && isExpanded && (
            <div>{renderFolderChildren(entry.path, level + 1)}</div>
          )}
        </div>
      )
    })
  }, [
    entries,
    expanded,
    activeFilePath,
    onOpenFile,
    openMenuPath,
    toggleExpand,
    createFile,
    createFolder,
    renamePath,
    copyPath,
    deletePath,
  ])

  // Auto-expand root folder when rootPath changes (e.g. opening a project from Files tab)
  useEffect(() => {
    if (rootPath && !expanded[rootPath]) {
      loadFolder(rootPath)
      setExpanded((prev) => ({ ...prev, [rootPath]: true }))
    }
  }, [rootPath]) // eslint-disable-line react-hooks/exhaustive-deps

  const rootDisplay = useMemo(() => folderName(rootPath), [rootPath])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFiles = e.dataTransfer.files
    if (!droppedFiles || droppedFiles.length === 0) return

    // If a single folder is dropped and no root is set, open it as workspace root
    const firstFile = droppedFiles[0]
    const firstPath = (firstFile as any).path as string | undefined
    if (droppedFiles.length === 1 && firstPath) {
      // Check if it's a directory by trying to open it
      if (!rootPath) {
        // Try to use it as workspace root
        onRootPathChange(firstPath)
        await loadFolder(firstPath)
        setExpanded({ [firstPath]: true })
        onNotify?.(`Opened folder: ${baseName(firstPath)}`, 'success')
        return
      }
    }

    // Copy files into workspace root
    if (!rootPath) {
      onNotify?.('Open a folder first, then drag files into it.')
      return
    }

    let imported = 0
    for (let i = 0; i < droppedFiles.length; i++) {
      const file = droppedFiles[i]
      const filePath = (file as any).path as string | undefined
      if (filePath) {
        const ok = await window.electronAPI.importFileToWorkspace(filePath, rootPath)
        if (ok) { imported++; continue }
      }
      // Fallback: read file content via browser API and create in workspace
      try {
        const text = await file.text()
        const ok = await window.electronAPI.createWorkspaceFileFromAI(rootPath, file.name, text)
        if (ok) imported++
      } catch { /* skip unreadable files */ }
    }
    if (imported > 0) {
      await loadFolder(rootPath)
      onNotify?.(`Imported ${imported} file${imported > 1 ? 's' : ''} into workspace.`, 'success')
    } else {
      onNotify?.('No files could be imported. Try opening a folder first.', 'warning')
    }
  }, [rootPath, onRootPathChange, loadFolder, onNotify])

  return (
    <div
      className={`explorer-pane ${dragOver ? 'explorer-drag-over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="explorer-header">
        <span className="explorer-title">Explorer</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="explorer-open-btn" onClick={handleOpenFolder}>Open Folder</button>
          {rootPath && (
            <button
              className="explorer-open-btn"
              onClick={() => {
                onRootPathChange(null)
                setExpanded({})
                setEntries({})
              }}
              title="Close Folder"
            >
              {'\u2715'}
            </button>
          )}
        </div>
      </div>

      {!rootPath ? (
        <div className="explorer-empty">
          <p>No folder open</p>
          <span>Open a folder to browse and edit project files.</span>
        </div>
      ) : (
        <>
          <div className="explorer-root-row">
            <button className="explorer-expand-btn" onClick={() => toggleExpand(rootPath)}>
              {expanded[rootPath] ? '▾' : '▸'}
            </button>
            <span className="explorer-item-icon">{'\u{1F4C2}'}</span>
            <span className="explorer-root-name" title={rootPath}>{rootDisplay}</span>
            <div className="explorer-item-actions">
              <button className="explorer-menu-btn" onClick={(e) => {
                e.stopPropagation()
                setOpenMenuPath((prev) => prev === rootPath ? null : rootPath)
              }}>
                ⋯
              </button>
              {openMenuPath === rootPath && (
                <div className="explorer-menu" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { createFile(rootPath); setOpenMenuPath(null) }}>New File</button>
                  <button onClick={() => { createFolder(rootPath); setOpenMenuPath(null) }}>New Folder</button>
                  <button onClick={() => { copyPath(rootPath); setOpenMenuPath(null) }}>Copy Path</button>
                  <button onClick={() => { window.electronAPI.showInExplorer(rootPath); setOpenMenuPath(null) }}>
                    Reveal in Explorer
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="explorer-tree">
            {expanded[rootPath] && renderFolderChildren(rootPath, 1)}
          </div>
        </>
      )}
    </div>
  )
}
