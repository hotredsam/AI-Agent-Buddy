import React, { useState, useEffect, useCallback } from 'react'
import type { Settings, ThemeName } from '../types'
import { THEMES, THEME_NAMES, applyTheme } from '../themes'

interface SettingsPaneProps {
  settings: Settings
  onSave: (settings: Settings) => void
}

export default function SettingsPane({ settings, onSave }: SettingsPaneProps) {
  const [form, setForm] = useState<Settings>({ ...settings })
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'ok' | 'fail'>('unknown')
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [checkpointCopied, setCheckpointCopied] = useState(false)
  const [diagResult, setDiagResult] = useState<{
    serverReachable: boolean
    availableModels: string[]
    modelFound: boolean
    error: string | null
  } | null>(null)

  // Sync form when settings prop changes
  useEffect(() => {
    setForm({ ...settings })
  }, [settings])

  // Live connection status: check on mount and every 30s
  const checkConnection = useCallback(async () => {
    try {
      const result = await window.electronAPI.checkHealth()
      setConnectionStatus(result ? 'ok' : 'fail')
    } catch {
      setConnectionStatus('fail')
    }
  }, [])

  useEffect(() => {
    checkConnection()
    const interval = setInterval(checkConnection, 30000)
    return () => clearInterval(interval)
  }, [checkConnection])

  const handleChange = (field: keyof Settings, value: string | number) => {
    const updated = { ...form, [field]: value }
    setForm(updated)
    setSaved(false)

    // Live-apply theme on click (no Save needed for themes)
    if (field === 'theme') {
      applyTheme(value as ThemeName)
      onSave(updated)
    }
  }

  const handleSave = () => {
    onSave(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleRunDiagnostics = async () => {
    setTesting(true)
    try {
      const diag = await window.electronAPI.runDiagnostics()
      setConnectionStatus(diag.serverReachable ? (diag.modelFound ? 'ok' : 'fail') : 'fail')
      setDiagResult(diag)
    } catch {
      setConnectionStatus('fail')
      setDiagResult(null)
    } finally {
      setTesting(false)
    }
  }

  const handleCopyCheckpoint = async () => {
    try {
      const prompt = await window.electronAPI.generateCheckpoint()
      await navigator.clipboard.writeText(prompt)
      setCheckpointCopied(true)
      setTimeout(() => setCheckpointCopied(false), 2000)
    } catch (err) {
      console.error('Failed to generate checkpoint:', err)
    }
  }

  return (
    <div className="settings-pane">
      {/* Main settings card */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h2>Settings</h2>
          <div className="live-status" onClick={checkConnection} title="Click to refresh">
            <span className={`status-dot ${connectionStatus}`} />
            <span className="live-status-text">
              {connectionStatus === 'ok' && 'Connected'}
              {connectionStatus === 'fail' && 'Offline'}
              {connectionStatus === 'unknown' && 'Checking...'}
            </span>
          </div>
        </div>

        <div className="settings-field">
          <label htmlFor="ollama-endpoint">Ollama Endpoint</label>
          <input
            id="ollama-endpoint"
            type="text"
            value={form.ollamaEndpoint}
            onChange={(e) => handleChange('ollamaEndpoint', e.target.value)}
            placeholder="http://127.0.0.1:11434"
          />
        </div>

        <div className="settings-field">
          <label htmlFor="model-name">Model Name</label>
          <input
            id="model-name"
            type="text"
            value={form.modelName}
            onChange={(e) => handleChange('modelName', e.target.value)}
            placeholder="glm-4.7-flash"
          />
        </div>

        <div className="settings-field">
          <label htmlFor="num-ctx">
            Context Window Size
            <span
              className="settings-help-icon"
              title="How many tokens the model can process at once. Higher values use more GPU memory. If your requested size exceeds available memory, the app automatically falls back to a smaller size and updates this value."
            >
              ?
            </span>
          </label>
          <input
            id="num-ctx"
            type="number"
            value={form.numCtx}
            onChange={(e) => handleChange('numCtx', parseInt(e.target.value, 10) || 0)}
            min={256}
            step={256}
          />
          <span className="settings-field-hint">
            Recommended: 4096-8192 for most models. Higher = more memory.
          </span>
        </div>

        <div className="settings-field">
          <label>Theme <span className="settings-hint-inline">(click to apply)</span></label>
          <div className="theme-grid">
            {THEME_NAMES.map((name) => (
              <button
                key={name}
                className={`theme-swatch ${form.theme === name ? 'active' : ''}`}
                onClick={() => handleChange('theme', name)}
                title={THEMES[name].label}
                style={{ background: THEMES[name].accent }}
              >
                <span className="theme-swatch-emoji">{THEMES[name].emoji}</span>
                <span className="theme-swatch-label">{THEMES[name].label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-actions">
          <button className="settings-btn primary" onClick={handleSave}>
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      {/* Info cards: horizontal row */}
      <div className="settings-info-row">
        {/* Connection card */}
        <div className="settings-info-card">
          <div className="info-card-icon">
            <span className={`status-dot-lg ${connectionStatus}`} />
          </div>
          <h3>Connection</h3>
          <p>
            {connectionStatus === 'ok' && 'Ollama is running and reachable'}
            {connectionStatus === 'fail' && 'Cannot reach Ollama server'}
            {connectionStatus === 'unknown' && 'Checking connection...'}
          </p>
          <button className="settings-btn secondary" onClick={checkConnection}>
            Refresh
          </button>
        </div>

        {/* Checkpoint card */}
        <div className="settings-info-card">
          <div className="info-card-icon">{'\u{1F4CB}'}</div>
          <h3>Checkpoint</h3>
          <p>Copy a project snapshot prompt for cloud AI review</p>
          <button className="settings-btn secondary" onClick={handleCopyCheckpoint}>
            {checkpointCopied ? 'Copied!' : 'Copy Prompt'}
          </button>
        </div>

        {/* Diagnostics card */}
        <div className="settings-info-card">
          <div className="info-card-icon">{'\u{1F50D}'}</div>
          <h3>Diagnostics</h3>
          {diagResult ? (
            <div className="diag-results-mini">
              <div className="diag-row">
                <span className={`status-dot ${diagResult.serverReachable ? 'ok' : 'fail'}`} />
                <span>Server: {diagResult.serverReachable ? 'OK' : 'Down'}</span>
              </div>
              <div className="diag-row">
                <span className={`status-dot ${diagResult.modelFound ? 'ok' : 'fail'}`} />
                <span>Model: {diagResult.modelFound ? 'Found' : 'Missing'}</span>
              </div>
              {diagResult.availableModels.length > 0 && (
                <div className="diag-models-mini">
                  {diagResult.availableModels.slice(0, 3).join(', ')}
                  {diagResult.availableModels.length > 3 && ` +${diagResult.availableModels.length - 3} more`}
                </div>
              )}
            </div>
          ) : (
            <p>Run a full system check</p>
          )}
          <button
            className="settings-btn secondary"
            onClick={handleRunDiagnostics}
            disabled={testing}
          >
            {testing ? 'Running...' : 'Run Check'}
          </button>
        </div>
      </div>
    </div>
  )
}
