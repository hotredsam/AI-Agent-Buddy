import React, { useEffect, useRef, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

interface TerminalPaneProps {
  cwd?: string
}

export default function TerminalPane({ cwd }: TerminalPaneProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const termInstance = useRef<Terminal | null>(null)
  const fitAddon = useRef<FitAddon | null>(null)
  const ptyIdRef = useRef<number | null>(null)

  const initTerminal = useCallback(async () => {
    if (!terminalRef.current || termInstance.current) return

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

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(terminalRef.current)
    fit.fit()

    termInstance.current = term
    fitAddon.current = fit

    // Spawn PTY
    const ptyId = await window.electronAPI.terminalSpawn({
      cwd: cwd || undefined,
      cols: term.cols,
      rows: term.rows,
    })
    ptyIdRef.current = ptyId

    // Listen for data
    const unsubData = window.electronAPI.onTerminalData(ptyId, (data) => {
      term.write(data)
    })

    // Listen for exit
    const unsubExit = window.electronAPI.onTerminalExit(ptyId, ({ exitCode }) => {
      term.write(`\r\n[Process exited with code ${exitCode}]\r\n`)
      ptyIdRef.current = null
    })

    // Handle user input
    term.onData((data) => {
      if (ptyIdRef.current !== null) {
        window.electronAPI.terminalWrite(ptyIdRef.current, data)
      }
    })

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fit.fit()
      if (ptyIdRef.current !== null) {
        window.electronAPI.terminalResize(ptyIdRef.current, term.cols, term.rows)
      }
    })
    resizeObserver.observe(terminalRef.current)

    return () => {
      unsubData()
      unsubExit()
      resizeObserver.disconnect()
      if (ptyIdRef.current !== null) {
        window.electronAPI.terminalKill(ptyIdRef.current)
      }
      term.dispose()
      termInstance.current = null
    }
  }, [cwd])

  useEffect(() => {
    const cleanupPromise = initTerminal()
    return () => {
      cleanupPromise.then(cleanup => cleanup?.())
    }
  }, [initTerminal])

  const handleClear = useCallback(() => {
    termInstance.current?.clear()
  }, [])

  return (
    <div className="terminal-pane">
      <div className="terminal-topbar">
        <span className="terminal-topbar-title">Terminal</span>
        <button className="terminal-clear-btn" onClick={handleClear} title="Clear terminal">
          Clear
        </button>
      </div>
      <div className="terminal-xterm-container" ref={terminalRef} />
    </div>
  )
}
