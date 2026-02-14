import React, { useState, useEffect, useCallback } from 'react'
import type { UserFile, UserFileInfo, AgentTask } from '../types'

interface WorkspacePaneProps {
  onOpenInEditor?: (file: UserFile) => void | Promise<void>
  onOpenProject?: (path: string) => void
  onNotify?: (text: string, type?: 'error' | 'warning' | 'success') => void
  onDownloaded?: (name: string, path: string) => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

function fileIcon(file: UserFile): string {
  if (file.isDirectory) return '\u{1F4C1}' // Folder
  
  const type = file.type
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

export default function WorkspacePane({ onOpenInEditor, onOpenProject, onNotify, onDownloaded }: WorkspacePaneProps) {
  const [activeTab, setActiveTab] = useState<'files' | 'agents' | 'browse'>('files')
  const [files, setFiles] = useState<UserFile[]>([])
  const [loading, setLoading] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [draggingFileName, setDraggingFileName] = useState<string | null>(null)
  const [dropTargetName, setDropTargetName] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    file: UserFile
    x: number
    y: number
  } | null>(null)
  const [detailsFile, setDetailsFile] = useState<UserFileInfo | null>(null)
  const [renameTarget, setRenameTarget] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modified' | 'type' | 'custom'>('modified')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [customOrder, setCustomOrder] = useState<string[]>([])
  const [dropInsertIndex, setDropInsertIndex] = useState<number | null>(null)
  
  // Search/filter
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  // PC Browser state
  const [browsePath, setBrowsePath] = useState<string | null>(null)
  const [browseEntries, setBrowseEntries] = useState<Array<{ name: string; path: string; isDirectory: boolean; size: number; modifiedAt: string }>>([])
  const [browseLoading, setBrowseLoading] = useState(false)

  // Agent state
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [newGoal, setNewGoal] = useState('')
  const [creatingTask, setCreatingTask] = useState(false)

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

  const loadTasks = useCallback(async () => {
    try {
      const list = await window.electronAPI.listAgentTasks()
      setTasks(list)
    } catch (err) {
      console.error('Failed to list tasks:', err)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'files') loadFiles()
    if (activeTab === 'agents') {
      loadTasks()
      const unsub = window.electronAPI.onAgentUpdate((updatedTasks) => {
        setTasks(updatedTasks)
      })
      return () => unsub()
    }
  }, [activeTab, loadFiles, loadTasks])

  useEffect(() => {
    const closeMenu = () => setContextMenu(null)
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

  const handleCreateProject = async (name?: string) => {
    const projectName = name || newProjectName.trim()
    if (!projectName) {
      setShowNewProject(true)
      setNewProjectName(`Project-${new Date().toISOString().slice(0, 10)}`)
      return
    }
    setShowNewProject(false)
    setNewProjectName('')
    try {
      const project = await window.electronAPI.createProject(projectName)
      if (project) {
        await loadFiles()
        onNotify?.(`Project "${projectName}" created.`, 'success')
      } else {
        onNotify?.(`Failed to create project "${projectName}". It may already exist.`)
      }
    } catch (error: any) {
      onNotify?.(`Failed to create project: ${error?.message || 'Unknown error'}`)
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
    setDropTargetName(null)

    if (draggingFileName) {
      setDraggingFileName(null)
      return
    }

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
    if (ok) onDownloaded?.(file.name, file.path)
  }

  const handleRename = async (file: UserFile) => {
    setRenameTarget(file.name)
    setRenameValue(file.name)
  }

  const handleRenameConfirm = async () => {
    const oldName = renameTarget
    const nextName = renameValue.trim()
    setRenameTarget(null)
    setRenameValue('')
    if (!oldName || !nextName || nextName === oldName) return
    const renamed = await window.electronAPI.renameFile(oldName, nextName)
    if (renamed) {
      setFiles((prev) => prev.map((f) => (f.name === oldName ? renamed : f)))
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

  const handleMoveIntoFolder = async (fileName: string, destinationFolder: UserFile) => {
    const moved = await window.electronAPI.moveFile(fileName, destinationFolder.path)
    if (moved) {
      await loadFiles()
      onNotify?.(`Moved "${fileName}" to "${destinationFolder.name}".`, 'success')
    } else {
      onNotify?.(`Failed to move "${fileName}" into "${destinationFolder.name}".`)
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

  const handleCreateTask = async () => {
    if (!newGoal.trim()) return
    setCreatingTask(true)
    try {
      await window.electronAPI.createAgentTask(newGoal.trim())
      setNewGoal('')
      loadTasks()
      onNotify?.('Task created. Agent is planning...', 'success')
    } catch (err: any) {
      onNotify?.('Failed to create task: ' + err.message)
    } finally {
      setCreatingTask(false)
    }
  }

  const handleApproveTask = async (id: string) => {
    try {
      await window.electronAPI.approveAgentTask(id)
      loadTasks()
      onNotify?.('Plan approved. Agent is building...', 'success')
    } catch (err: any) {
      onNotify?.('Failed to approve task: ' + err.message)
    }
  }

  return (
    <div className="workspace-pane-container">
      <div className="workspace-tab-bar">
        <button
          className={`workspace-tab-btn ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          Library
        </button>
        <button
          className={`workspace-tab-btn ${activeTab === 'browse' ? 'active' : ''}`}
          onClick={() => setActiveTab('browse')}
        >
          Browse PC
        </button>
        <button
          className={`workspace-tab-btn ${activeTab === 'agents' ? 'active' : ''}`}
          onClick={() => setActiveTab('agents')}
        >
          Agents
        </button>
      </div>

      {activeTab === 'files' ? (
        <div
          className="workspace-pane-files"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="files-header">
            <h2>Library</h2>
            <div className="files-search-bar">
              <input
                className="files-search-input"
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                className={`files-view-toggle ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode(v => v === 'list' ? 'grid' : 'list')}
                title={viewMode === 'list' ? 'Grid view' : 'List view'}
              >
                {viewMode === 'list' ? '\u2637' : '\u2630'}
              </button>
            </div>
            <div className="files-header-actions">
              <select
                className="files-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                title="Sort files"
              >
                <option value="modified">Sort: Modified</option>
                <option value="name">Sort: Name</option>
                <option value="size">Sort: Size</option>
                <option value="type">Sort: Type</option>
                <option value="custom">Sort: Custom</option>
              </select>
              <button className="files-btn secondary" onClick={() => setSortDir((p) => p === 'asc' ? 'desc' : 'asc')} title={`Sort direction: ${sortDir === 'asc' ? 'Ascending' : 'Descending'}`}>
                {sortDir === 'asc' ? '\u2191' : '\u2193'}
              </button>
              <button className="files-btn" onClick={() => handleCreateProject()} title="Create Project">
                + Project
              </button>
              <button className="files-btn" onClick={handleImport} title="Import file">
                + File
              </button>
              <button className="files-btn secondary" onClick={handleOpenFolder} title="Open folder">
                Open Folder
              </button>
            </div>
          </div>

          {showNewProject && (
            <div className="new-project-inline">
              <input
                className="new-project-input"
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateProject(newProjectName.trim())
                  if (e.key === 'Escape') { setShowNewProject(false); setNewProjectName('') }
                }}
                placeholder="Project name..."
              />
              <button className="files-btn" onClick={() => handleCreateProject(newProjectName.trim())}>Create</button>
              <button className="files-btn secondary" onClick={() => { setShowNewProject(false); setNewProjectName('') }}>Cancel</button>
            </div>
          )}

          {loading ? (
            <div className="files-empty">Loading...</div>
          ) : files.length === 0 ? (
            <div className={`files-empty ${dragOver ? 'drag-over' : ''}`}>
              <span className="files-empty-icon">{'\u{1F4C2}'}</span>
              <p>No files yet</p>
              <span className="files-empty-sub">Drag files here or click "Import"</span>
            </div>
          ) : (
            <div className={`files-list ${viewMode === 'grid' ? 'files-grid-view' : ''}`}>
              {[...files].filter(f => !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase())).sort((a, b) => {
                const dir = sortDir === 'asc' ? 1 : -1
                if (a.isDirectory && !b.isDirectory) return -1
                if (!a.isDirectory && b.isDirectory) return 1

                if (sortBy === 'custom' && customOrder.length > 0) {
                  const ai = customOrder.indexOf(a.name)
                  const bi = customOrder.indexOf(b.name)
                  const aIdx = ai >= 0 ? ai : customOrder.length
                  const bIdx = bi >= 0 ? bi : customOrder.length
                  return (aIdx - bIdx) * dir
                }
                if (sortBy === 'name') return a.name.localeCompare(b.name) * dir
                if (sortBy === 'size') return (a.size - b.size) * dir
                if (sortBy === 'type') return a.type.localeCompare(b.type) * dir
                return (new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime()) * dir
              }).map((file, fileIdx) => (
                <div
                  key={file.name}
                  className={`file-item ${draggingFileName === file.name ? 'dragging' : ''} ${file.isDirectory ? 'is-folder' : ''} ${dropTargetName === file.name ? 'drop-target' : ''} ${dropInsertIndex === fileIdx ? 'drop-insert-before' : ''} ${dropInsertIndex === fileIdx + 1 && dropInsertIndex !== null ? 'drop-insert-after' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move'
                    setDraggingFileName(file.name)
                  }}
                  onDragEnd={() => {
                    setDraggingFileName(null)
                    setDropTargetName(null)
                    setDropInsertIndex(null)
                  }}
                  onDoubleClick={() => {
                    if (file.isDirectory && onOpenProject) {
                      onOpenProject(file.path)
                    } else if (onOpenInEditor) {
                      onOpenInEditor(file)
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({ file, x: e.clientX, y: e.clientY })
                  }}
                  onDragOver={(e) => {
                    if (!draggingFileName || draggingFileName === file.name) return
                    e.preventDefault()
                    e.stopPropagation()
                    if (file.isDirectory) {
                      setDropTargetName(file.name)
                      setDropInsertIndex(null)
                    } else {
                      // Reorder mode: show insertion indicator
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      const midY = rect.top + rect.height / 2
                      const insertAt = e.clientY < midY ? fileIdx : fileIdx + 1
                      setDropInsertIndex(insertAt)
                      setDropTargetName(null)
                    }
                  }}
                  onDragLeave={() => {
                    if (dropTargetName === file.name) setDropTargetName(null)
                  }}
                  onDrop={async (e) => {
                    if (!draggingFileName || draggingFileName === file.name) return
                    e.preventDefault()
                    e.stopPropagation()
                    const sourceName = draggingFileName
                    setDraggingFileName(null)
                    setDropTargetName(null)
                    setDropInsertIndex(null)

                    if (file.isDirectory) {
                      await handleMoveIntoFolder(sourceName, file)
                    } else {
                      // Reorder: build custom order from current sorted list
                      const currentOrder = [...files].sort((a, b) => {
                        if (a.isDirectory && !b.isDirectory) return -1
                        if (!a.isDirectory && b.isDirectory) return 1
                        return 0
                      }).map(f => f.name)
                      const fromIdx = currentOrder.indexOf(sourceName)
                      if (fromIdx >= 0) {
                        currentOrder.splice(fromIdx, 1)
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        const midY = rect.top + rect.height / 2
                        const toIdx = e.clientY < midY ? currentOrder.indexOf(file.name) : currentOrder.indexOf(file.name) + 1
                        currentOrder.splice(toIdx, 0, sourceName)
                      }
                      setCustomOrder(currentOrder)
                      setSortBy('custom')
                    }
                  }}
                >
                  <span className="file-icon">{fileIcon(file)}</span>
                  <div className="file-info">
                    {renameTarget === file.name ? (
                      <input
                        className="file-rename-input"
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={handleRenameConfirm}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameConfirm()
                          if (e.key === 'Escape') { setRenameTarget(null); setRenameValue('') }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="file-name">{file.name}</span>
                    )}
                    <span className="file-meta">{file.isDirectory ? 'Project Folder' : formatFileSize(file.size)}</span>
                  </div>
                  {!file.isDirectory && (
                    <button className="file-open-code-btn" onClick={() => onOpenInEditor?.(file)} title="Open in Code">
                      Open
                    </button>
                  )}
                  {file.isDirectory && (
                    <button className="file-open-code-btn" onClick={() => onOpenProject?.(file.path)} title="Open Project">
                      Open Project
                    </button>
                  )}
                  <button
                    className="file-item-delete-btn"
                    onClick={(e) => { e.stopPropagation(); handleDelete(file.name) }}
                    title={`Delete "${file.name}"`}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          {contextMenu && (
            <div
              className="file-action-menu context-menu"
              style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              {!contextMenu.file.isDirectory && (
                <button onClick={() => { handleSaveAs(contextMenu.file); setContextMenu(null) }}>
                  Download
                </button>
              )}
              <button onClick={() => { onOpenInEditor?.(contextMenu.file); setContextMenu(null) }}>
                Open in Code
              </button>
              <button onClick={() => { handleRename(contextMenu.file); setContextMenu(null) }}>
                Rename
              </button>
              <button onClick={() => { handleMove(contextMenu.file); setContextMenu(null) }}>
                Move
              </button>
              <button onClick={() => { handleDuplicate(contextMenu.file); setContextMenu(null) }}>
                Duplicate
              </button>
              <button onClick={() => { handleCopyPath(contextMenu.file); setContextMenu(null) }}>
                Copy Path
              </button>
              <button onClick={() => { handleDetails(contextMenu.file); setContextMenu(null) }}>
                View Details
              </button>
              <button onClick={() => { handleShowInExplorer(contextMenu.file); setContextMenu(null) }}>
                Open in Explorer
              </button>
              {!contextMenu.file.isDirectory && (
                <button onClick={() => { handleOpenExternal(contextMenu.file); setContextMenu(null) }}>
                  Open Externally
                </button>
              )}
              <button className="danger" onClick={() => { handleDelete(contextMenu.file.name); setContextMenu(null) }}>
                Delete
              </button>
            </div>
          )}
        </div>
      ) : activeTab === 'browse' ? (
        <div className="workspace-pane-browse">
          <div className="browse-header">
            <h2>Browse PC</h2>
            <button className="files-btn" onClick={async () => {
              const picked = await window.electronAPI.pickWorkspaceFolder()
              if (picked) {
                setBrowsePath(picked)
                setBrowseLoading(true)
                try {
                  const entries = await window.electronAPI.listWorkspaceFolder(picked)
                  setBrowseEntries(entries)
                } catch { setBrowseEntries([]) }
                setBrowseLoading(false)
              }
            }}>
              Choose Folder
            </button>
          </div>

          {browsePath && (
            <div className="browse-breadcrumb">
              {browsePath.split(/[\\/]/).filter(Boolean).map((part, idx, arr) => {
                const fullPath = arr.slice(0, idx + 1).join('\\')
                return (
                  <span key={idx}>
                    <button className="browse-crumb-btn" onClick={async () => {
                      setBrowsePath(fullPath)
                      setBrowseLoading(true)
                      try {
                        const entries = await window.electronAPI.listWorkspaceFolder(fullPath)
                        setBrowseEntries(entries)
                      } catch { setBrowseEntries([]) }
                      setBrowseLoading(false)
                    }}>
                      {part}
                    </button>
                    {idx < arr.length - 1 && <span className="browse-crumb-sep">/</span>}
                  </span>
                )
              })}
            </div>
          )}

          {browseLoading ? (
            <div className="files-empty">Loading...</div>
          ) : !browsePath ? (
            <div className="files-empty">
              <span className="files-empty-icon">{'\u{1F4BB}'}</span>
              <p>Select a folder to browse</p>
              <span className="files-empty-sub">Click "Choose Folder" to navigate your PC</span>
            </div>
          ) : (
            <div className="files-list">
              {browseEntries.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1
                if (!a.isDirectory && b.isDirectory) return 1
                return a.name.localeCompare(b.name)
              }).map(entry => (
                <div
                  key={entry.path}
                  className={`file-item ${entry.isDirectory ? 'is-folder' : ''}`}
                  onDoubleClick={async () => {
                    if (entry.isDirectory) {
                      setBrowsePath(entry.path)
                      setBrowseLoading(true)
                      try {
                        const entries = await window.electronAPI.listWorkspaceFolder(entry.path)
                        setBrowseEntries(entries)
                      } catch { setBrowseEntries([]) }
                      setBrowseLoading(false)
                    } else if (onOpenInEditor) {
                      onOpenInEditor({ name: entry.name, path: entry.path, size: entry.size, modifiedAt: entry.modifiedAt, type: entry.name.split('.').pop() || 'unknown', isDirectory: false })
                    }
                  }}
                >
                  <span className="file-icon">{entry.isDirectory ? '\u{1F4C1}' : '\u{1F4C4}'}</span>
                  <div className="file-info">
                    <span className="file-name">{entry.name}</span>
                    <span className="file-meta">{entry.isDirectory ? 'Folder' : formatFileSize(entry.size)}</span>
                  </div>
                  {!entry.isDirectory && (
                    <button className="file-open-code-btn" onClick={async () => {
                      const imported = await window.electronAPI.importFileByPath(entry.path)
                      if (imported) {
                        onNotify?.(`Added "${entry.name}" to Library.`, 'success')
                      }
                    }} title="Add to Library">
                      + Library
                    </button>
                  )}
                  {entry.isDirectory && (
                    <button className="file-open-code-btn" onClick={() => onOpenProject?.(entry.path)} title="Open as Project">
                      Open
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="workspace-pane-agents">
          <div className="agents-header">
            <h2>Agent Orchestration</h2>
            <p className="agents-sub">Define complex multi-step tasks for AI agents to execute.</p>
          </div>
          
          <div className="agent-task-creation">
            <input 
              className="agent-task-input"
              placeholder="Describe a goal (e.g. 'Refactor the sidebar component')"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
            />
            <button 
              className="files-btn"
              onClick={handleCreateTask}
              disabled={creatingTask || !newGoal.trim()}
            >
              {creatingTask ? 'Creating...' : 'Start Task'}
            </button>
          </div>

          <div className="agent-task-list">
            {tasks.length === 0 ? (
              <div className="agents-empty">
                <span className="big-icon">{'\u{1F916}'}</span>
                <p>No active tasks</p>
                <span className="sub">Create a task above to start an agent workflow.</span>
              </div>
            ) : (
              tasks.map(task => (
                <div key={task.id} className="agent-task-card">
                  <div className="agent-task-header">
                    <span className="agent-task-status" data-status={task.status}>{task.status.replace('_', ' ')}</span>
                    <span className="agent-task-time">{new Date(task.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <h3 className="agent-task-goal">{task.goal}</h3>
                  
                  {task.status === 'planning' && <div className="agent-step-loading">Generating plan...</div>}
                  
                  {task.plan && (
                    <div className="agent-task-plan">
                      <strong>Plan Summary:</strong>
                      <p>{task.plan.slice(0, 150)}...</p>
                    </div>
                  )}

                  {task.steps.length > 0 && (
                    <div className="agent-steps-list">
                      {task.steps.map((step, idx) => (
                        <div key={step.id} className={`agent-step-item ${step.status}`}>
                          <span className="step-icon">
                            {step.status === 'completed' ? '\u2713' :
                             step.status === 'in_progress' ? '\u29D7' :
                             step.status === 'failed' ? '\u2715' : '\u25CB'}
                          </span>
                          <span className="step-desc">{step.description}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {task.status === 'waiting_approval' && (
                    <div className="agent-task-actions">
                      <button className="files-btn" onClick={() => handleApproveTask(task.id)}>
                        Approve Plan & Execute
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
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


