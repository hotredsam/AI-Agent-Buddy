import React, { useState, useEffect } from 'react'

export default function Titlebar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (!window.electronAPI) {
      console.error('electronAPI not found in window')
      return
    }
    window.electronAPI.windowIsMaximized().then(setIsMaximized)
  }, [])

  const handleMinimize = () => window.electronAPI?.windowMinimize()
  const handleMaximize = async () => {
    if (!window.electronAPI) return
    await window.electronAPI.windowMaximize()
    const max = await window.electronAPI.windowIsMaximized()
    setIsMaximized(max)
  }
  const handleClose = () => window.electronAPI?.windowClose()

  return (
    <div className="custom-titlebar">
      <div className="titlebar-drag-region">
        <span className="titlebar-title">AI Agent IDE</span>
      </div>
      <div className="titlebar-controls">
        <button
          className="titlebar-btn minimize"
          onClick={handleMinimize}
          title="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1">
            <line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button
          className="titlebar-btn maximize"
          onClick={handleMaximize}
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="2" y="0" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
              <rect x="0" y="2" width="8" height="8" fill="var(--glass-sidebar, #0c0c14)" stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="0" y="0" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </button>
        <button
          className="titlebar-btn close"
          onClick={handleClose}
          title="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" />
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
