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
  isActive: boolean
  focusRequest: number
  onFocused: (sessionId: string) => void
  onExit: (sessionId: string, exitCode: number) => void
}

function defaultShells(): TerminalShellOption[] {
  return [{ id: 'powershell', label: 'Default Shell', available: true }]
}

function TerminalSessionView({ session, cwd, visible, isActive, focusRequest, onFocused, onExit }: TerminalSessionViewProps) {
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
    let disposeFocus: (() => void) | null = null

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
        const focusDisposable = term.onFocus(() => onFocused(session.id))
        disposeFocus = () => focusDisposable.dispose()

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
      if (disposeFocus) disposeFocus()
      resizeObserver?.disconnect()
      if (ptyIdRef.current !== null) {
        window.electronAPI.terminalKill(ptyIdRef.current).catch(() => {})
      }
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [cwd, onExit, onFocused, session.id, session.shellId])

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
    if (!visible || !isActive) return
    termRef.current?.focus()
  }, [focusRequest, isActive, visible])

  useEffect(() => {
    if (!termRef.current) return
    termRef.current.clear()
  }, [session.clearSignal])

  // Listen for agent terminal output and write to this terminal if it's active
  useEffect(() => {
    if (!isActive) return
    const handler = (e: Event) => {
      const data = (e as CustomEvent).detail
      if (data?.text && termRef.current) {
        const text = data.text.replace(/\n/g, '\r\n')
        termRef.current.write(`\x1b[36m[agent]\x1b[0m ${text}`)
      }
    }
    window.addEventListener('agent-terminal-output', handler)
    return () => window.removeEventListener('agent-terminal-output', handler)
  }, [isActive])

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
  const [focusRequest, setFocusRequest] = useState(0)
  const counterRef = useRef(0)
  const menuWrapRef = useRef<HTMLDivElement | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

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
    setFocusRequest((value) => value + 1)
    setMenuOpen(false)
  }, [createSession, selectedShellId])

  const activateSession = useCallback((id: string, shouldFocus = false) => {
    setActiveSessionId(id)
    if (shouldFocus) {
      setFocusRequest((value) => value + 1)
    }
  }, [])

  const closeTerminal = useCallback((id: string) => {
    setSessions((prev) => {
      if (prev.length <= 1) return prev
      const next = prev.filter((session) => session.id !== id)
      if (activeSessionId === id) {
        const fallback = next[next.length - 1]?.id || null
        setActiveSessionId(fallback)
        if (fallback) {
          setFocusRequest((value) => value + 1)
        }
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

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (menuWrapRef.current?.contains(target)) return
      setMenuOpen(false)
    }
    const onBlur = () => setMenuOpen(false)
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      menuButtonRef.current?.focus()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('blur', onBlur)
    window.addEventListener('keydown', onEscape)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('keydown', onEscape)
    }
  }, [menuOpen])

  // Listen for agent terminal output and write to active terminal
  useEffect(() => {
    if (!window.electronAPI?.onAgentTerminalOutput) return
    const unsub = window.electronAPI.onAgentTerminalOutput((data) => {
      // Write agent output to the terminal - it will be visible in the active session
      // We broadcast a custom event that the active TerminalSessionView can pick up
      window.dispatchEvent(new CustomEvent('agent-terminal-output', { detail: data }))
    })
    return unsub
  }, [])

  return (
    <div className="terminal-pane">
      <div className="terminal-topbar">
        <div className="terminal-category-tabs">
          <span className="terminal-category-tab active">TERMINAL</span>
          <span className="terminal-category-tab">OUTPUT</span>
        </div>
        <div
          className="terminal-tabs"
          role="tablist"
          aria-label="Terminals"
          onKeyDown={(event) => {
            if (!activeSessionId) return
            const currentIndex = sessions.findIndex((session) => session.id === activeSessionId)
            if (currentIndex < 0) return

            if (event.key === 'ArrowRight') {
              event.preventDefault()
              const next = sessions[(currentIndex + 1) % sessions.length]
              if (next) activateSession(next.id, true)
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault()
              const next = sessions[(currentIndex - 1 + sessions.length) % sessions.length]
              if (next) activateSession(next.id, true)
            } else if (event.key === 'Home') {
              event.preventDefault()
              if (sessions[0]) activateSession(sessions[0].id, true)
            } else if (event.key === 'End') {
              event.preventDefault()
              if (sessions[sessions.length - 1]) activateSession(sessions[sessions.length - 1].id, true)
            } else if (event.key === 'Delete' && sessions.length > 1) {
              event.preventDefault()
              closeTerminal(activeSessionId)
            }
          }}
        >
          {sessions.map((session) => (
            <button
              key={session.id}
              className={`terminal-tab ${session.id === activeSessionId ? 'active' : ''}`}
              role="tab"
              id={`terminal-tab-${session.id}`}
              aria-selected={session.id === activeSessionId}
              aria-controls={`terminal-panel-${session.id}`}
              tabIndex={session.id === activeSessionId ? 0 : -1}
              onClick={() => activateSession(session.id, true)}
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

        <div className="terminal-menu-wrap" ref={menuWrapRef}>
          <button
            className="terminal-topbar-btn"
            onClick={() => setMenuOpen((prev) => !prev)}
            title="Terminal list"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls="terminal-list-menu"
            ref={menuButtonRef}
          >
            Terminals
          </button>
          {menuOpen && (
            <div
              className="terminal-menu"
              id="terminal-list-menu"
              role="menu"
              ref={menuRef}
              onKeyDown={(event) => {
                const menuButtons = Array.from(
                  menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitemradio"]') || []
                )
                if (menuButtons.length === 0) return
                const activeIndex = menuButtons.findIndex((button) => button === document.activeElement)
                const moveFocus = (index: number) => {
                  const bounded = ((index % menuButtons.length) + menuButtons.length) % menuButtons.length
                  menuButtons[bounded]?.focus()
                }

                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  moveFocus(activeIndex + 1)
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  moveFocus(activeIndex - 1)
                } else if (event.key === 'Home') {
                  event.preventDefault()
                  moveFocus(0)
                } else if (event.key === 'End') {
                  event.preventDefault()
                  moveFocus(menuButtons.length - 1)
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  setMenuOpen(false)
                  menuButtonRef.current?.focus()
                } else if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  ;(document.activeElement as HTMLButtonElement | null)?.click()
                }
              }}
            >
              {sessions.map((session) => (
                <button
                  key={session.id}
                  className={session.id === activeSessionId ? 'active' : ''}
                  role="menuitemradio"
                  aria-checked={session.id === activeSessionId}
                  onClick={() => {
                    activateSession(session.id, true)
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
              id={`terminal-panel-${session.id}`}
              role="tabpanel"
              aria-labelledby={`terminal-tab-${session.id}`}
              style={{ display: visible ? 'block' : 'none' }}
            >
              <TerminalSessionView
                session={session}
                cwd={cwd}
                visible={visible}
                isActive={session.id === activeSessionId}
                focusRequest={focusRequest}
                onFocused={activateSession}
                onExit={handleSessionExit}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
