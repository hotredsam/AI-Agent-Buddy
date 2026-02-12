import React, { useState, useEffect } from 'react'
import type { Settings, ThemeName } from '../types'
import { THEMES, THEME_NAMES } from '../themes'

interface SettingsPaneProps {
  settings: Settings
  onSave: (settings: Settings) => void
}

export default function SettingsPane({ settings, onSave }: SettingsPaneProps) {
  const [form, setForm] = useState<Settings>({ ...settings })
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'ok' | 'fail'>('unknown')
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)
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

  const handleChange = (field: keyof Settings, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setConnectionStatus('unknown')
    try {
      const result = await window.electronAPI.checkHealth()
      setConnectionStatus(result ? 'ok' : 'fail')
    } catch {
      setConnectionStatus('fail')
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    onSave(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="settings-pane">
      <div className="settings-card">
        <h2>&#x2699; Settings</h2>

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
          <label htmlFor="num-ctx">Context Window Size</label>
          <input
            id="num-ctx"
            type="number"
            value={form.numCtx}
            onChange={(e) => handleChange('numCtx', parseInt(e.target.value, 10) || 0)}
            min={256}
            step={256}
          />
        </div>

        <div className="settings-field">
          <label>Theme</label>
          <div className="theme-grid">
            {THEME_NAMES.map((name) => (
              <button
                key={name}
                className={`theme-swatch ${form.theme === name ? 'active' : ''}`}
                onClick={() => handleChange('theme', name)}
                title={THEMES[name].label}
                style={{ background: THEMES[name].accent }}
              >
                <span className="theme-swatch-label">{THEMES[name].label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-actions">
          <button className="settings-btn primary" onClick={handleSave}>
            {saved ? 'Saved!' : 'Save'}
          </button>
          <button
            className="settings-btn secondary"
            onClick={handleTestConnection}
            disabled={testing}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>

          <div className="connection-status">
            <span
              className={`status-dot ${connectionStatus}`}
            />
            <span>
              {connectionStatus === 'ok' && 'Connected'}
              {connectionStatus === 'fail' && 'Unreachable'}
              {connectionStatus === 'unknown' && 'Not tested'}
            </span>
          </div>
        </div>
      </div>

      <div className="settings-card" style={{ marginTop: '24px' }}>
        <h2>Cloud Checkpoint</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Generate a project snapshot prompt for Codex / Claude review. Saves cloud credits by providing structured context.
        </p>
        <button
          className="settings-btn secondary"
          onClick={async () => {
            try {
              const prompt = await window.electronAPI.generateCheckpoint()
              await navigator.clipboard.writeText(prompt)
              setSaved(true)
              setTimeout(() => setSaved(false), 2000)
            } catch (err) {
              console.error('Failed to generate checkpoint:', err)
            }
          }}
        >
          {saved ? 'Copied to clipboard!' : 'Copy Checkpoint Prompt'}
        </button>
      </div>

      <div className="settings-card" style={{ marginTop: '24px' }}>
        <h2>Ollama Diagnostics</h2>
        <div className="diagnostics-panel">
          <button
            className="settings-btn secondary"
            onClick={async () => {
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
            }}
            disabled={testing}
          >
            {testing ? 'Running...' : 'Run Diagnostics'}
          </button>

          {diagResult && (
            <div className="diag-results">
              <div className="diag-row">
                <span className={`status-dot ${diagResult.serverReachable ? 'ok' : 'fail'}`} />
                <span>Server: {diagResult.serverReachable ? 'Connected' : 'Unreachable'}</span>
              </div>
              <div className="diag-row">
                <span className={`status-dot ${diagResult.modelFound ? 'ok' : 'fail'}`} />
                <span>Model "{form.modelName}": {diagResult.modelFound ? 'Available' : 'Not found'}</span>
              </div>
              {diagResult.availableModels.length > 0 && (
                <div className="diag-models">
                  <span className="diag-label">Available models:</span>
                  <span className="diag-model-list">{diagResult.availableModels.join(', ')}</span>
                </div>
              )}
              {diagResult.error && (
                <div className="diag-error">{diagResult.error}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
