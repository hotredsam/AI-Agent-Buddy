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

  const rootDisplay = useMemo(() => folderName(rootPath), [rootPath])

  return (
    <div className="explorer-pane">
      <div className="explorer-header">
        <span className="explorer-title">Explorer</span>
        <button className="explorer-open-btn" onClick={handleOpenFolder}>Open Folder</button>
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
