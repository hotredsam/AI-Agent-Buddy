import React, { useState, useEffect, useRef, useCallback } from 'react'

interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

interface HistoryEntry {
  command: string
  stdout: string
  stderr: string
  exitCode: number
  timestamp: string
}

interface TerminalPaneProps {
  onCommandResult?: (result: CommandResult) => void
}

export default function TerminalPane({ onCommandResult }: TerminalPaneProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [cwd, setCwd] = useState('')
  const [lastCommand, setLastCommand] = useState('')

  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load current working directory on mount
  useEffect(() => {
    const loadCwd = async () => {
      try {
        const dir = await window.electronAPI.terminalGetCwd()
        setCwd(dir)
      } catch (err) {
        console.error('Failed to get terminal cwd:', err)
      }
    }
    loadCwd()
  }, [])

  // Auto-scroll to bottom when history changes or a command is running
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [history, running])

  // Focus input when clicking on the terminal area
  const handlePaneClick = useCallback(() => {
    inputRef.current?.focus()
  }, [])

  const executeCommand = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || running) return

    setLastCommand(trimmed)
    setInput('')
    setRunning(true)

    try {
      const result: CommandResult = await window.electronAPI.terminalExecute(trimmed, cwd)

      const entry: HistoryEntry = {
        command: trimmed,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        timestamp: new Date().toLocaleTimeString(),
      }

      setHistory(prev => [...prev, entry])

      if (onCommandResult) {
        onCommandResult(result)
      }

      // Update cwd after cd commands
      if (/^\s*cd\s/.test(trimmed)) {
        try {
          const newCwd = await window.electronAPI.terminalGetCwd()
          setCwd(newCwd)
        } catch {
          // keep existing cwd
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      const entry: HistoryEntry = {
        command: trimmed,
        stdout: '',
        stderr: errorMsg,
        exitCode: 1,
        timestamp: new Date().toLocaleTimeString(),
      }
      setHistory(prev => [...prev, entry])
    } finally {
      setRunning(false)
      // Re-focus input after execution
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [input, running, cwd, onCommandResult])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      executeCommand()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (lastCommand) {
        setInput(lastCommand)
      }
    }
  }, [executeCommand, lastCommand])

  const handleClear = useCallback(() => {
    setHistory([])
  }, [])

  return (
    <div className="terminal-pane" onClick={handlePaneClick}>
      <div className="terminal-topbar">
        <span className="terminal-topbar-title">Terminal</span>
        {cwd && <span className="terminal-topbar-cwd" title={cwd}>{cwd}</span>}
        <button className="terminal-clear-btn" onClick={handleClear} title="Clear terminal">
          Clear
        </button>
      </div>

      <div className="terminal-output" ref={outputRef}>
        {history.map((entry, idx) => (
          <div key={idx} className="terminal-line">
            <div className="terminal-cmd">
              <span className="terminal-prompt">$</span> {entry.command}
              <span className="terminal-timestamp">{entry.timestamp}</span>
            </div>
            {entry.stdout && (
              <pre className="terminal-stdout">{entry.stdout}</pre>
            )}
            {entry.stderr && (
              <pre className="terminal-stderr">{entry.stderr}</pre>
            )}
            {entry.exitCode !== 0 && (
              <div className="terminal-exit-code">exit code: {entry.exitCode}</div>
            )}
          </div>
        ))}

        {running && (
          <div className="terminal-running">
            <span className="terminal-spinner" />
            Running...
          </div>
        )}
      </div>

      <div className="terminal-input-row">
        <span className="terminal-prompt">$</span>
        <input
          ref={inputRef}
          className="terminal-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command..."
          disabled={running}
          autoFocus
        />
      </div>
    </div>
  )
}
