import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import type { TerminalShellOption } from '../types'

interface TerminalPaneProps {
  cwd?: string
}

interface TerminalSessionState {
  id: string
  title: string
  shellId: TerminalShellOption['id']
  shellLabel: string
  clearSignal: number
}

interface TerminalSessionViewProps {
  session: TerminalSessionState
  cwd?: string
  visible: boolean
  onExit: (sessionId: string, exitCode: number) => void
}

function defaultShells(): TerminalShellOption[] {
  return [{ id: 'powershell', label: 'Default Shell', available: true }]
}

function TerminalSessionView({ session, cwd, visible, onExit }: TerminalSessionViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const ptyIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!containerRef.current || termRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
      theme: {
        background: '#0c0c14',
        foreground: '#e8e8ec',
        cursor: '#6eaaff',
        selectionBackground: '#6eaaff30',
        black: '#1c1c23',
        red: '#ff6b7a',
        green: '#63e6be',
        yellow: '#ffd966',
        blue: '#6eaaff',
        magenta: '#d499ff',
        cyan: '#70e0ff',
        white: '#e8e8ec',
      },
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitRef.current = fitAddon

    let unsubData = () => {}
    let unsubExit = () => {}
    let resizeObserver: ResizeObserver | null = null
    let cancelled = false

    const spawn = async () => {
      try {
        const ptyId = await window.electronAPI.terminalSpawn({
          cwd: cwd || undefined,
          cols: term.cols,
          rows: term.rows,
          shellId: session.shellId,
        })
        if (cancelled) {
          await window.electronAPI.terminalKill(ptyId)
          return
        }

        ptyIdRef.current = ptyId
        unsubData = window.electronAPI.onTerminalData(ptyId, (data) => {
          term.write(data)
        })
        unsubExit = window.electronAPI.onTerminalExit(ptyId, ({ exitCode }) => {
          term.write(`\r\n[Process exited with code ${exitCode}]\r\n`)
          ptyIdRef.current = null
          onExit(session.id, exitCode)
        })

        term.onData((data) => {
          if (ptyIdRef.current !== null) {
            window.electronAPI.terminalWrite(ptyIdRef.current, data)
          }
        })

        resizeObserver = new ResizeObserver(() => {
          fitAddon.fit()
          if (ptyIdRef.current !== null) {
            window.electronAPI.terminalResize(ptyIdRef.current, term.cols, term.rows)
          }
        })
        if (containerRef.current) {
          resizeObserver.observe(containerRef.current)
        }
      } catch (error: any) {
        term.writeln(`\r\n[Failed to launch terminal: ${error?.message || 'Unknown error'}]\r\n`)
      }
    }

    spawn()

    return () => {
      cancelled = true
      unsubData()
      unsubExit()
      resizeObserver?.disconnect()
      if (ptyIdRef.current !== null) {
        window.electronAPI.terminalKill(ptyIdRef.current).catch(() => {})
      }
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [cwd, onExit, session.id, session.shellId])

  useEffect(() => {
    if (!visible) return
    const id = window.requestAnimationFrame(() => {
      fitRef.current?.fit()
      if (ptyIdRef.current !== null && termRef.current) {
        window.electronAPI.terminalResize(ptyIdRef.current, termRef.current.cols, termRef.current.rows).catch(() => {})
      }
    })
    return () => window.cancelAnimationFrame(id)
  }, [visible])

  useEffect(() => {
    if (!termRef.current) return
    termRef.current.clear()
  }, [session.clearSignal])

  return <div className="terminal-xterm-container" ref={containerRef} />
}

export default function TerminalPane({ cwd }: TerminalPaneProps) {
  const [shellOptions, setShellOptions] = useState<TerminalShellOption[]>(defaultShells())
  const [selectedShellId, setSelectedShellId] = useState<TerminalShellOption['id']>('powershell')
  const [sessions, setSessions] = useState<TerminalSessionState[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [splitSessionId, setSplitSessionId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [exitCodes, setExitCodes] = useState<Record<string, number>>({})
  const counterRef = useRef(0)

  const resolveShell = useCallback((shellId?: string) => {
    const preferred = shellOptions.find((option) => option.id === shellId && option.available)
    if (preferred) return preferred
    return shellOptions.find((option) => option.available) || shellOptions[0]
  }, [shellOptions])

  const createSession = useCallback((requestedShellId?: string) => {
    const shell = resolveShell(requestedShellId)
    counterRef.current += 1
    return {
      id: `terminal-${counterRef.current}`,
      title: `Terminal ${counterRef.current}`,
      shellId: shell.id,
      shellLabel: shell.label,
      clearSignal: 0,
    } satisfies TerminalSessionState
  }, [resolveShell])

  useEffect(() => {
    let mounted = true
    window.electronAPI.terminalListShells().then((items) => {
      if (!mounted) return
      const valid = items.length > 0 ? items : defaultShells()
      setShellOptions(valid)
      const fallback = valid.find((item) => item.available) || valid[0]
      setSelectedShellId(fallback.id)
      setSessions((prev) => {
        if (prev.length > 0) return prev
        const first = {
          id: 'terminal-1',
          title: 'Terminal 1',
          shellId: fallback.id,
          shellLabel: fallback.label,
          clearSignal: 0,
        } satisfies TerminalSessionState
        counterRef.current = 1
        setActiveSessionId(first.id)
        return [first]
      })
    }).catch(() => {
      const fallback = defaultShells()[0]
      setShellOptions(defaultShells())
      setSelectedShellId(fallback.id)
      setSessions((prev) => {
        if (prev.length > 0) return prev
        counterRef.current = 1
        const first = {
          id: 'terminal-1',
          title: 'Terminal 1',
          shellId: fallback.id,
          shellLabel: fallback.label,
          clearSignal: 0,
        } satisfies TerminalSessionState
        setActiveSessionId(first.id)
        return [first]
      })
    })

    return () => {
      mounted = false
    }
  }, [])

  const openNewTerminal = useCallback((shellId?: string) => {
    const next = createSession(shellId || selectedShellId)
    setSessions((prev) => [...prev, next])
    setActiveSessionId(next.id)
    setMenuOpen(false)
  }, [createSession, selectedShellId])

  const closeTerminal = useCallback((id: string) => {
    setSessions((prev) => {
      if (prev.length <= 1) return prev
      const next = prev.filter((session) => session.id !== id)
      if (activeSessionId === id) {
        setActiveSessionId(next[next.length - 1]?.id || null)
      }
      if (splitSessionId === id) {
        setSplitSessionId(null)
      }
      return next
    })
  }, [activeSessionId, splitSessionId])

  const handleClear = useCallback(() => {
    if (!activeSessionId) return
    setSessions((prev) => prev.map((session) => (
      session.id === activeSessionId
        ? { ...session, clearSignal: session.clearSignal + 1 }
        : session
    )))
  }, [activeSessionId])

  const toggleSplit = useCallback(() => {
    if (!activeSessionId) return
    if (splitSessionId) {
      setSplitSessionId(null)
      return
    }

    const candidate = sessions.find((session) => session.id !== activeSessionId)
    if (candidate) {
      setSplitSessionId(candidate.id)
      return
    }

    const next = createSession(selectedShellId)
    setSessions((prev) => [...prev, next])
    setSplitSessionId(next.id)
  }, [activeSessionId, createSession, selectedShellId, sessions, splitSessionId])

  const visibleSessionIds = useMemo(() => {
    if (!activeSessionId) return [] as string[]
    if (!splitSessionId || splitSessionId === activeSessionId) {
      return [activeSessionId]
    }
    return [activeSessionId, splitSessionId]
  }, [activeSessionId, splitSessionId])

  const isSplitActive = visibleSessionIds.length > 1

  const handleSessionExit = useCallback((sessionId: string, exitCode: number) => {
    setExitCodes((prev) => ({ ...prev, [sessionId]: exitCode }))
  }, [])

  return (
    <div className="terminal-pane">
      <div className="terminal-topbar">
        <div className="terminal-tabs">
          {sessions.map((session) => (
            <button
              key={session.id}
              className={`terminal-tab ${session.id === activeSessionId ? 'active' : ''}`}
              onClick={() => setActiveSessionId(session.id)}
              title={`${session.title} (${session.shellLabel})`}
            >
              <span>{session.title}</span>
              {typeof exitCodes[session.id] === 'number' && <em>{`[${exitCodes[session.id]}]`}</em>}
              {sessions.length > 1 && (
                <span
                  className="terminal-tab-close"
                  onClick={(event) => {
                    event.stopPropagation()
                    closeTerminal(session.id)
                  }}
                >
                  x
                </span>
              )}
            </button>
          ))}
        </div>

        <select
          className="terminal-shell-select"
          value={selectedShellId}
          onChange={(e) => setSelectedShellId(e.target.value as TerminalShellOption['id'])}
          title="Terminal shell"
        >
          {shellOptions.map((option) => (
            <option key={option.id} value={option.id} disabled={!option.available}>
              {option.available ? option.label : `${option.label} (Unavailable)`}
            </option>
          ))}
        </select>

        <button className="terminal-topbar-btn" onClick={() => openNewTerminal()} title="New terminal">
          +
        </button>
        <button className={`terminal-topbar-btn ${isSplitActive ? 'active' : ''}`} onClick={toggleSplit} title="Toggle split">
          Split
        </button>

        <div className="terminal-menu-wrap">
          <button className="terminal-topbar-btn" onClick={() => setMenuOpen((prev) => !prev)} title="Terminal list">
            Terminals
          </button>
          {menuOpen && (
            <div className="terminal-menu">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  className={session.id === activeSessionId ? 'active' : ''}
                  onClick={() => {
                    setActiveSessionId(session.id)
                    setMenuOpen(false)
                  }}
                >
                  {session.title} ({session.shellLabel})
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="terminal-clear-btn" onClick={handleClear} title="Clear terminal">
          Clear
        </button>
      </div>

      <div className={`terminal-sessions ${isSplitActive ? 'split-horizontal' : ''}`}>
        {sessions.map((session) => {
          const visible = visibleSessionIds.includes(session.id)
          const role = session.id === activeSessionId ? 'primary' : (session.id === splitSessionId ? 'secondary' : 'hidden')
          return (
            <div
              key={session.id}
              className={`terminal-session-slot ${role}`}
              style={{ display: visible ? 'block' : 'none' }}
            >
              <TerminalSessionView
                session={session}
                cwd={cwd}
                visible={visible}
                onExit={handleSessionExit}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
