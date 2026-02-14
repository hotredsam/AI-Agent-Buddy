import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'

interface CommandPaletteProps {
  visible: boolean
  onClose: () => void
  onSelectFile: (filePath: string) => void
  workspaceRootPath: string | null
}

interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

function fuzzyMatch(query: string, target: string): boolean {
  const lowerQuery = query.toLowerCase()
  const lowerTarget = target.toLowerCase()
  let qi = 0
  for (let ti = 0; ti < lowerTarget.length && qi < lowerQuery.length; ti++) {
    if (lowerTarget[ti] === lowerQuery[qi]) qi++
  }
  return qi === lowerQuery.length
}

async function collectFiles(rootPath: string, maxDepth = 4): Promise<FileEntry[]> {
  const results: FileEntry[] = []
  const queue: Array<{ path: string; depth: number }> = [{ path: rootPath, depth: 0 }]

  while (queue.length > 0 && results.length < 500) {
    const item = queue.shift()
    if (!item || item.depth > maxDepth) continue

    try {
      const entries = await window.electronAPI.listWorkspaceFolder(item.path)
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue
        if (entry.isDirectory) {
          queue.push({ path: entry.path, depth: item.depth + 1 })
        } else {
          results.push({ name: entry.name, path: entry.path, isDirectory: false })
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  return results
}

export default function CommandPalette({
  visible,
  onClose,
  onSelectFile,
  workspaceRootPath,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [files, setFiles] = useState<FileEntry[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!visible) {
      setQuery('')
      setSelectedIndex(0)
      return
    }
    inputRef.current?.focus()

    if (workspaceRootPath) {
      setLoading(true)
      collectFiles(workspaceRootPath).then((entries) => {
        setFiles(entries)
        setLoading(false)
      })
    }
  }, [visible, workspaceRootPath])

  const filtered = useMemo(() => {
    if (!query.trim()) return files.slice(0, 50)
    return files.filter((f) => fuzzyMatch(query, f.name) || fuzzyMatch(query, f.path)).slice(0, 50)
  }, [query, files])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleSelect = useCallback((filePath: string) => {
    onSelectFile(filePath)
    onClose()
  }, [onSelectFile, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex].path)
      }
    }
  }, [filtered, selectedIndex, handleSelect, onClose])

  if (!visible) return null

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="command-palette-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={loading ? 'Loading workspace files...' : 'Search files by name...'}
        />
        <div className="command-palette-results">
          {filtered.length === 0 && !loading && (
            <div className="command-palette-empty">
              {workspaceRootPath ? 'No matching files' : 'Open a workspace folder first'}
            </div>
          )}
          {filtered.map((file, idx) => {
            const relativePath = workspaceRootPath
              ? file.path.replace(workspaceRootPath, '').replace(/^[\\/]/, '')
              : file.path
            return (
              <div
                key={file.path}
                className={`command-palette-item ${idx === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleSelect(file.path)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <span className="command-palette-item-name">{file.name}</span>
                <span className="command-palette-item-path">{relativePath}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
