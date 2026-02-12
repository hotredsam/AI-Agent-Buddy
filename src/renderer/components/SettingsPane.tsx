import React, { useState, useEffect, useCallback } from 'react'
import type { Settings, ThemeName } from '../types'
import { THEMES, THEME_NAMES, applyTheme } from '../themes'

interface SettingsPaneProps {
  settings: Settings
  onSave: (settings: Settings) => void
}

const API_PROVIDERS = [
  { key: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
  { key: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...' },
  { key: 'google', label: 'Google AI', placeholder: 'AIza...' },
  { key: 'groq', label: 'Groq', placeholder: 'gsk_...' },
] as const

export default function SettingsPane({ settings, onSave }: SettingsPaneProps) {
  const [form, setForm] = useState<Settings>({ ...settings })
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'ok' | 'fail'>('unknown')
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [checkpointCopied, setCheckpointCopied] = useState(false)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [pullModelName, setPullModelName] = useState(settings.modelName || '')
  const [pullingModel, setPullingModel] = useState(false)
  const [imagePrompt, setImagePrompt] = useState('A clean product hero image of a futuristic coding desk setup')
  const [imageGenerating, setImageGenerating] = useState(false)
  const [imageResultPath, setImageResultPath] = useState<string | null>(null)
  const [diagResult, setDiagResult] = useState<{
    serverReachable: boolean
    availableModels: string[]
    modelFound: boolean
    error: string | null
  } | null>(null)

  // Sync form when settings prop changes
  useEffect(() => {
    setForm({ ...settings })
    setPullModelName(settings.modelName || '')
  }, [settings])

  const refreshModels = useCallback(async () => {
    try {
      const models = await window.electronAPI.listModels()
      setAvailableModels(models)
    } catch {
      setAvailableModels([])
    }
  }, [])

  const refreshConnection = useCallback(async () => {
    try {
      const result = await window.electronAPI.checkHealth()
      setConnectionStatus(result ? 'ok' : 'fail')
    } catch {
      setConnectionStatus('fail')
    }
  }, [])

  const [systemStats, setSystemStats] = useState<{ freeMem: number; totalMem: number; platform: string; cpus: number } | null>(null)

  const refreshSystemStats = useCallback(async () => {
    try {
      const stats = await window.electronAPI.getSystemStats()
      setSystemStats(stats)
    } catch {
      setSystemStats(null)
    }
  }, [])

  useEffect(() => {
    refreshConnection()
    refreshModels()
    refreshSystemStats()
    const interval = setInterval(() => {
      refreshConnection()
      refreshSystemStats()
    }, 30000)
    return () => clearInterval(interval)
  }, [refreshConnection, refreshModels, refreshSystemStats])

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

  const handleApiKeyChange = (provider: string, value: string) => {
    const currentKeys = form.apiKeys || {}
    const updatedKeys = { ...currentKeys, [provider]: value }
    // Remove empty keys
    if (!value.trim()) delete updatedKeys[provider]
    const updated = { ...form, apiKeys: updatedKeys }
    setForm(updated)
    setSaved(false)
  }

  const toggleShowKey = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }))
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

  const handlePullModel = async () => {
    const name = pullModelName.trim()
    if (!name) return
    setPullingModel(true)
    try {
      const ok = await window.electronAPI.pullModel(name)
      if (ok) {
        await refreshModels()
        const updated = { ...form, modelName: name }
        setForm(updated)
        onSave(updated)
      }
    } finally {
      setPullingModel(false)
    }
  }

  const handleGenerateImage = async () => {
    setImageGenerating(true)
    setImageResultPath(null)
    try {
      const result = await window.electronAPI.generateImage({
        prompt: imagePrompt.trim(),
        provider: form.imageProvider || 'openai',
        model: form.imageModel || 'gpt-image-1',
      })
      if (result.filePath) {
        setImageResultPath(result.filePath)
      }
    } finally {
      setImageGenerating(false)
    }
  }

  return (
    <div className="settings-pane">
      {/* Main settings card */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h2>Settings</h2>
          <div className="live-status" onClick={refreshConnection} title="Click to refresh">
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
          {availableModels.length > 0 && (
            <div className="model-quick-picks">
              {availableModels.slice(0, 8).map((model) => (
                <button
                  key={model}
                  className={`model-pick-btn ${form.modelName === model ? 'active' : ''}`}
                  onClick={() => handleChange('modelName', model)}
                  type="button"
                >
                  {model}
                </button>
              ))}
            </div>
          )}
          <div className="model-pull-row">
            <input
              type="text"
              value={pullModelName}
              onChange={(e) => setPullModelName(e.target.value)}
              placeholder="Pull model (e.g. qwen2.5-coder:7b)"
            />
            <button className="settings-btn secondary" onClick={handlePullModel} disabled={pullingModel}>
              {pullingModel ? 'Pulling...' : 'Pull'}
            </button>
            <button className="settings-btn secondary" onClick={refreshModels} type="button">
              Refresh
            </button>
          </div>
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

      {/* API Keys card */}
      <div className="settings-card api-keys-card">
        <h2>API Keys</h2>
        <span className="settings-field-hint" style={{ marginBottom: 16, display: 'block' }}>
          Store API keys for cloud AI providers. Keys are saved locally and never transmitted except to the provider's API.
        </span>
        {API_PROVIDERS.map(({ key, label, placeholder }) => (
          <div key={key} className="settings-field api-key-field">
            <label htmlFor={`api-key-${key}`}>{label}</label>
            <div className="api-key-input-row">
              <input
                id={`api-key-${key}`}
                type={showKeys[key] ? 'text' : 'password'}
                value={form.apiKeys?.[key] || ''}
                onChange={(e) => handleApiKeyChange(key, e.target.value)}
                placeholder={placeholder}
                autoComplete="off"
              />
              <button
                className="api-key-toggle"
                onClick={() => toggleShowKey(key)}
                title={showKeys[key] ? 'Hide key' : 'Show key'}
                type="button"
              >
                {showKeys[key] ? '\u{1F441}' : '\u{1F512}'}
              </button>
            </div>
            {form.apiKeys?.[key] && (
              <span className="api-key-status connected">Key saved</span>
            )}
          </div>
        ))}
      </div>

      {/* Model Provider card */}
      <div className="settings-card provider-card">
        <h2>Model Provider</h2>
        <span className="settings-field-hint" style={{ marginBottom: 16, display: 'block' }}>
          Choose which AI provider to use. Cloud providers require an API key above.
        </span>
        <div className="provider-grid">
          <div
            className={`provider-option ${(form.activeProvider || 'ollama') === 'ollama' ? 'active' : ''}`}
            onClick={() => {
              const updated = { ...form, activeProvider: 'ollama' as const }
              setForm(updated)
              onSave(updated)
            }}
          >
            <div className="provider-icon">{'\u{1F999}'}</div>
            <span className="provider-name">Ollama</span>
            <span className={`provider-status ${connectionStatus === 'ok' ? 'connected' : ''}`}>
              {connectionStatus === 'ok' ? 'Connected' : 'Local'}
            </span>
          </div>
          {API_PROVIDERS.map(({ key, label }) => {
            const hasKey = !!(form.apiKeys?.[key])
            return (
              <div
                key={key}
                className={`provider-option ${(form.activeProvider) === key ? 'active' : ''} ${!hasKey ? 'disabled' : ''}`}
                onClick={() => {
                  if (!hasKey) return
                  const updated = { ...form, activeProvider: key as any }
                  setForm(updated)
                  onSave(updated)
                }}
                title={hasKey ? `Switch to ${label}` : `Add ${label} API key first`}
              >
                <div className="provider-icon">
                  {key === 'openai' && '\u{1F7E2}'}
                  {key === 'anthropic' && '\u{1F7E0}'}
                  {key === 'google' && '\u{1F535}'}
                  {key === 'groq' && '\u{26A1}'}
                </div>
                <span className="provider-name">{label}</span>
                <span className={`provider-status ${hasKey ? 'connected' : ''}`}>
                  {hasKey ? 'Key set' : 'No key'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="settings-card provider-card">
        <h2>Coding Model</h2>
        <span className="settings-field-hint" style={{ marginBottom: 16, display: 'block' }}>
          Choose a dedicated provider/model for code generation in the Code view AI panel.
        </span>
        <div className="settings-field">
          <label htmlFor="coding-provider">Coding Provider</label>
          <select
            id="coding-provider"
            value={form.codingProvider || form.activeProvider || 'ollama'}
            onChange={(e) => {
              const updated = { ...form, codingProvider: e.target.value as any }
              setForm(updated)
              onSave(updated)
            }}
          >
            <option value="ollama">Ollama (Local)</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
            <option value="groq">Groq</option>
          </select>
        </div>
        <div className="settings-field">
          <label htmlFor="coding-model">Coding Model</label>
          <input
            id="coding-model"
            type="text"
            value={form.codingModel || form.modelName}
            onChange={(e) => {
              const updated = { ...form, codingModel: e.target.value }
              setForm(updated)
            }}
            onBlur={() => onSave(form)}
            placeholder="qwen2.5-coder:7b"
          />
        </div>
      </div>

      <div className="settings-card provider-card">
        <h2>Image Model</h2>
        <span className="settings-field-hint" style={{ marginBottom: 16, display: 'block' }}>
          Configure image generation provider/model. Use `/image ...` in chat to generate.
        </span>
        <div className="settings-field">
          <label htmlFor="image-provider">Image Provider</label>
          <select
            id="image-provider"
            value={form.imageProvider || 'openai'}
            onChange={(e) => {
              const updated = { ...form, imageProvider: e.target.value as any }
              setForm(updated)
              onSave(updated)
            }}
          >
            <option value="openai">OpenAI</option>
            <option value="ollama">Ollama</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
            <option value="groq">Groq</option>
          </select>
        </div>
        <div className="settings-field">
          <label htmlFor="image-model">Image Model</label>
          <input
            id="image-model"
            type="text"
            value={form.imageModel || 'gpt-image-1'}
            onChange={(e) => {
              const updated = { ...form, imageModel: e.target.value }
              setForm(updated)
            }}
            onBlur={() => onSave(form)}
            placeholder="gpt-image-1"
          />
        </div>
        <div className="settings-field">
          <label htmlFor="image-prompt">Test Prompt</label>
          <input
            id="image-prompt"
            type="text"
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
            placeholder="Describe image to generate"
          />
        </div>
        <div className="settings-actions">
          <button className="settings-btn secondary" onClick={handleGenerateImage} disabled={imageGenerating}>
            {imageGenerating ? 'Generating...' : 'Generate Test Image'}
          </button>
          {imageResultPath && (
            <span className="settings-field-hint" style={{ marginLeft: 12 }}>
              Saved to: {imageResultPath}
            </span>
          )}
        </div>
      </div>

      <div className="settings-card provider-card">
        <h2>AI Instructions</h2>
        <span className="settings-field-hint" style={{ marginBottom: 16, display: 'block' }}>
          Default system instructions used by each AI mode. Keep these short and specific.
        </span>
        <div className="settings-field">
          <label htmlFor="prompt-chat">Chat</label>
          <textarea
            id="prompt-chat"
            value={form.systemPrompts?.chat || ''}
            onChange={(e) => setForm({
              ...form,
              systemPrompts: { ...(form.systemPrompts || {} as any), chat: e.target.value } as any,
            })}
            onBlur={() => onSave(form)}
          />
        </div>
        <div className="settings-field">
          <label htmlFor="prompt-coding">Coding</label>
          <textarea
            id="prompt-coding"
            value={form.systemPrompts?.coding || ''}
            onChange={(e) => setForm({
              ...form,
              systemPrompts: { ...(form.systemPrompts || {} as any), coding: e.target.value } as any,
            })}
            onBlur={() => onSave(form)}
          />
        </div>
        <div className="settings-field">
          <label htmlFor="prompt-plan">Plan</label>
          <textarea
            id="prompt-plan"
            value={form.systemPrompts?.plan || ''}
            onChange={(e) => setForm({
              ...form,
              systemPrompts: { ...(form.systemPrompts || {} as any), plan: e.target.value } as any,
            })}
            onBlur={() => onSave(form)}
          />
        </div>
        <div className="settings-field">
          <label htmlFor="prompt-build">Build</label>
          <textarea
            id="prompt-build"
            value={form.systemPrompts?.build || ''}
            onChange={(e) => setForm({
              ...form,
              systemPrompts: { ...(form.systemPrompts || {} as any), build: e.target.value } as any,
            })}
            onBlur={() => onSave(form)}
          />
        </div>
        <div className="settings-field">
          <label htmlFor="prompt-bugfix">Bug Fix</label>
          <textarea
            id="prompt-bugfix"
            value={form.systemPrompts?.bugfix || ''}
            onChange={(e) => setForm({
              ...form,
              systemPrompts: { ...(form.systemPrompts || {} as any), bugfix: e.target.value } as any,
            })}
            onBlur={() => onSave(form)}
          />
        </div>
        <div className="settings-field">
          <label htmlFor="prompt-image">Image</label>
          <textarea
            id="prompt-image"
            value={form.systemPrompts?.image || ''}
            onChange={(e) => setForm({
              ...form,
              systemPrompts: { ...(form.systemPrompts || {} as any), image: e.target.value } as any,
            })}
            onBlur={() => onSave(form)}
          />
        </div>
      </div>

      {/* Permissions card */}
      <div className="settings-card permissions-card">
        <h2>Permissions</h2>
        <span className="settings-field-hint" style={{ marginBottom: 16, display: 'block' }}>
          Control what the AI agent is allowed to do on your system.
        </span>

        <div className="permission-toggle-row">
          <div className="permission-label">
            <span className="permission-label-title">Terminal Access</span>
            <span className="permission-label-desc">Allow running commands in the built-in terminal</span>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={form.permissions?.allowTerminal ?? true}
              onChange={(e) => {
                const perms = { ...(form.permissions || { allowTerminal: true, allowFileWrite: true, allowAICodeExec: false }), allowTerminal: e.target.checked }
                const updated = { ...form, permissions: perms }
                setForm(updated)
                setSaved(false)
              }}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="permission-toggle-row">
          <div className="permission-label">
            <span className="permission-label-title">File Write</span>
            <span className="permission-label-desc">Allow saving and modifying files on disk</span>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={form.permissions?.allowFileWrite ?? true}
              onChange={(e) => {
                const perms = { ...(form.permissions || { allowTerminal: true, allowFileWrite: true, allowAICodeExec: false }), allowFileWrite: e.target.checked }
                const updated = { ...form, permissions: perms }
                setForm(updated)
                setSaved(false)
              }}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="permission-toggle-row">
          <div className="permission-label">
            <span className="permission-label-title">AI Code Execution</span>
            <span className="permission-label-desc">Allow AI to automatically run generated code (dangerous)</span>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={form.permissions?.allowAICodeExec ?? false}
              onChange={(e) => {
                const perms = { ...(form.permissions || { allowTerminal: true, allowFileWrite: true, allowAICodeExec: false }), allowAICodeExec: e.target.checked }
                const updated = { ...form, permissions: perms }
                setForm(updated)
                setSaved(false)
              }}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="settings-actions">
          <button className="settings-btn primary" onClick={handleSave}>
            {saved ? 'Saved!' : 'Save Permissions'}
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
          <button className="settings-btn secondary" onClick={refreshConnection}>
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
        {/* System card */}
        <div className="settings-info-card">
          <div className="info-card-icon">{'\u{1F5A5}'}</div>
          <h3>System</h3>
          {systemStats ? (
            <div className="diag-results-mini">
              <div className="diag-row" style={{ fontSize: '10px' }}>
                {systemStats.cpus} CPUs | {systemStats.platform}
              </div>
              <div className="diag-row" style={{ marginTop: 4 }}>
                <div style={{ width: '100%', height: 4, background: 'var(--glass-input)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${Math.round(((systemStats.totalMem - systemStats.freeMem) / systemStats.totalMem) * 100)}%`,
                    background: 'var(--accent)'
                  }} />
                </div>
              </div>
              <div className="diag-models-mini">
                RAM: {Math.round((systemStats.totalMem - systemStats.freeMem) / 1024 / 1024 / 1024)}GB / {Math.round(systemStats.totalMem / 1024 / 1024 / 1024)}GB
              </div>
            </div>
          ) : (
            <p>Loading system stats...</p>
          )}
          <button className="settings-btn secondary" onClick={refreshSystemStats}>
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}
