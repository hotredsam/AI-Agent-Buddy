import React, { useState, useEffect, useCallback } from 'react'
import type { Settings, ThemeName } from '../types'
import { THEMES, THEME_NAMES, BASE_THEME_NAMES, applyTheme } from '../themes'

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

const DEFAULT_AGENT_SAFETY = {
  maxActions: 120,
  maxFileWrites: 80,
  maxCommands: 24,
  maxBytesWritten: 1_000_000,
  maxContractViolations: 12,
  maxCommandTimeoutMs: 120_000,
  commandKillGraceMs: 2_000,
  maxViolationRetriesPerStep: 2,
}

type SectionKey = 'general' | 'provider' | 'llamacpp' | 'coding' | 'image' | 'apikeys' | 'prompts' | 'permissions' | 'safety' | 'tools' | 'guide'

export default function SettingsPane({ settings, onSave }: SettingsPaneProps) {
  const [form, setForm] = useState<Settings>({ ...settings })
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'ok' | 'fail'>('unknown')
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [availableImageModels, setAvailableImageModels] = useState<string[]>([])
  const [pullModelName, setPullModelName] = useState(settings.modelName || '')
  const [pullingModel, setPullingModel] = useState(false)
  const [availableLlamaCppModels, setAvailableLlamaCppModels] = useState<string[]>([])
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    general: true,
    provider: true,
    llamacpp: false,
    coding: false,
    image: false,
    apikeys: false,
    prompts: false,
    permissions: false,
    safety: false,
    tools: false,
    guide: false,
  })

  const [systemStats, setSystemStats] = useState<{ freeMem: number; totalMem: number; platform: string; cpus: number } | null>(null)

  useEffect(() => {
    setForm({ ...settings })
    setPullModelName(settings.modelName || '')
  }, [settings])

  const toggleSection = (key: SectionKey) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const refreshModels = useCallback(async () => {
    try {
      const models = await window.electronAPI.listModels()
      setAvailableModels(models)
    } catch {
      setAvailableModels([])
    }
  }, [])

  const refreshImageModels = useCallback(async () => {
    try {
      const models = await window.electronAPI.listImageModels()
      setAvailableImageModels(models)
    } catch {
      setAvailableImageModels([])
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
    refreshImageModels()
    refreshSystemStats()
    const interval = setInterval(() => {
      refreshConnection()
      refreshSystemStats()
    }, 30000)
    return () => clearInterval(interval)
  }, [refreshConnection, refreshModels, refreshImageModels, refreshSystemStats])

  useEffect(() => {
    if ((form.imageProvider || 'ollama') !== 'ollama') return
    if ((form.imageModel || '').trim()) return
    if (availableImageModels.length === 0) return
    const updated = { ...form, imageModel: availableImageModels[0] }
    setForm(updated)
    onSave(updated)
  }, [availableImageModels, form, onSave])

  const handleChange = (field: keyof Settings, value: string | number) => {
    const updated = { ...form, [field]: value }
    setForm(updated)
    setSaved(false)
    if (field === 'theme') {
      applyTheme(value as ThemeName)
      onSave(updated)
    }
  }

  const handleApiKeyChange = (provider: string, value: string) => {
    const currentKeys = form.apiKeys || {}
    const updatedKeys = { ...currentKeys, [provider]: value }
    if (!value.trim()) delete updatedKeys[provider]
    const updated = { ...form, apiKeys: updatedKeys }
    setForm(updated)
    setSaved(false)
  }

  const toggleShowKey = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }))
  }

  const agentSafety = { ...DEFAULT_AGENT_SAFETY, ...(form.agentSafety || {}) }

  const updateAgentSafetyField = (field: keyof typeof DEFAULT_AGENT_SAFETY, value: number) => {
    const normalized = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
    const updated = { ...form, agentSafety: { ...agentSafety, [field]: normalized } }
    setForm(updated)
    setSaved(false)
  }

  const handleSave = () => {
    onSave(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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

  const allModelOptions = [...new Set([...availableModels, ...availableLlamaCppModels])]

  const SectionHeader = ({ sectionKey, title, badge }: { sectionKey: SectionKey; title: string; badge?: string }) => (
    <button className="settings-section-toggle" onClick={() => toggleSection(sectionKey)}>
      <span className="settings-section-arrow">{openSections[sectionKey] ? '\u25BE' : '\u25B8'}</span>
      <span className="settings-section-title">{title}</span>
      {badge && <span className="settings-section-badge">{badge}</span>}
    </button>
  )

  return (
    <div className="settings-pane settings-compact">
      {/* Top bar with save + status */}
      <div className="settings-topbar">
        <h2>Settings</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="live-status" onClick={refreshConnection} title="Click to refresh">
            <span className={`status-dot ${connectionStatus}`} />
            <span className="live-status-text">
              {connectionStatus === 'ok' && 'Connected'}
              {connectionStatus === 'fail' && 'Offline'}
              {connectionStatus === 'unknown' && 'Checking...'}
            </span>
          </div>
          {systemStats && (
            <span className="settings-sys-info">
              {systemStats.cpus} CPUs | {Math.round(systemStats.totalMem / 1024 / 1024 / 1024)}GB RAM
            </span>
          )}
          <button className="settings-btn primary" onClick={handleSave}>
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      <div className="settings-scroll">
        {/* Profile Picture */}
        <div className="profile-picture-section">
          <div
            className="profile-avatar"
            style={form.profilePicture ? { backgroundImage: `url(${form.profilePicture})` } : undefined}
          >
            {!form.profilePicture && (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </div>
          <div className="profile-picture-actions">
            <span className="profile-picture-label">Profile Picture</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                style={{ display: 'none' }}
                id="profile-picture-input"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    const dataUrl = reader.result as string
                    const updated = { ...form, profilePicture: dataUrl }
                    setForm(updated)
                    onSave(updated)
                  }
                  reader.readAsDataURL(file)
                  e.target.value = ''
                }}
              />
              <button className="settings-btn secondary" onClick={() => {
                document.getElementById('profile-picture-input')?.click()
              }}>Upload</button>
              {form.profilePicture && (
                <button className="settings-btn secondary" onClick={() => {
                  const updated = { ...form, profilePicture: undefined }
                  setForm(updated)
                  onSave(updated)
                }}>Remove</button>
              )}
            </div>
          </div>
        </div>

        {/* General */}
        <div className="settings-section">
          <SectionHeader sectionKey="general" title="General" />
          {openSections.general && (
            <div className="settings-section-body">
              <div className="settings-row">
                <label>Ollama Endpoint</label>
                <input
                  type="text"
                  value={form.ollamaEndpoint}
                  onChange={(e) => handleChange('ollamaEndpoint', e.target.value)}
                  placeholder="http://127.0.0.1:11434"
                />
              </div>
              <div className="settings-row">
                <label>Chat Model</label>
                {availableModels.length > 0 ? (
                  <select
                    value={form.modelName}
                    onChange={(e) => handleChange('modelName', e.target.value)}
                  >
                    <option value="">-- Select --</option>
                    {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.modelName}
                    onChange={(e) => handleChange('modelName', e.target.value)}
                    placeholder="glm-4.7-flash"
                  />
                )}
              </div>
              <div className="settings-row">
                <label>Context Window</label>
                <input
                  type="number"
                  value={form.numCtx}
                  onChange={(e) => handleChange('numCtx', parseInt(e.target.value, 10) || 0)}
                  min={256}
                  step={256}
                />
              </div>
              <div className="settings-row">
                <label>Pull Model</label>
                <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                  <input
                    type="text"
                    value={pullModelName}
                    onChange={(e) => setPullModelName(e.target.value)}
                    placeholder="e.g. qwen2.5-coder:7b"
                    style={{ flex: 1 }}
                  />
                  <button className="settings-btn secondary" onClick={handlePullModel} disabled={pullingModel}>
                    {pullingModel ? '...' : 'Pull'}
                  </button>
                  <button className="settings-btn secondary" onClick={refreshModels}>Refresh</button>
                </div>
              </div>
              <div className="settings-row">
                <label>Mode</label>
                <div className="dark-light-toggle">
                  <button
                    className={`mode-toggle-btn ${form.darkMode !== false ? 'active' : ''}`}
                    onClick={() => {
                      const u = { ...form, darkMode: true }
                      setForm(u)
                      onSave(u)
                      applyTheme((u.theme as ThemeName) || 'glass', true)
                    }}
                  >
                    Dark
                  </button>
                  <button
                    className={`mode-toggle-btn ${form.darkMode === false ? 'active' : ''}`}
                    onClick={() => {
                      const u = { ...form, darkMode: false }
                      setForm(u)
                      onSave(u)
                      applyTheme((u.theme as ThemeName) || 'glass', false)
                    }}
                  >
                    Light
                  </button>
                </div>
              </div>
              <div className="settings-row">
                <label>Theme</label>
                <div className="theme-grid">
                  {BASE_THEME_NAMES.map((name) => (
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
            </div>
          )}
        </div>

        {/* Provider */}
        <div className="settings-section">
          <SectionHeader sectionKey="provider" title="AI Provider" badge={form.activeProvider || 'ollama'} />
          {openSections.provider && (
            <div className="settings-section-body">
              <div className="provider-grid">
                <div
                  className={`provider-option ${(form.activeProvider || 'ollama') === 'ollama' ? 'active' : ''}`}
                  onClick={() => { const u = { ...form, activeProvider: 'ollama' as const }; setForm(u); onSave(u) }}
                >
                  <span className="provider-name">{'\u{1F999}'} Ollama</span>
                  <span className={`provider-status ${connectionStatus === 'ok' ? 'connected' : ''}`}>
                    {connectionStatus === 'ok' ? 'Connected' : 'Local'}
                  </span>
                </div>
                <div
                  className={`provider-option ${form.activeProvider === 'llamacpp' ? 'active' : ''}`}
                  onClick={() => { const u = { ...form, activeProvider: 'llamacpp' as const }; setForm(u); onSave(u) }}
                >
                  <span className="provider-name">{'\u{1F4BB}'} llama.cpp</span>
                  <span className="provider-status">Local</span>
                </div>
                {API_PROVIDERS.map(({ key, label }) => {
                  const hasKey = !!(form.apiKeys?.[key])
                  return (
                    <div
                      key={key}
                      className={`provider-option ${form.activeProvider === key ? 'active' : ''} ${!hasKey ? 'disabled' : ''}`}
                      onClick={() => {
                        if (!hasKey) return
                        const u = { ...form, activeProvider: key as any }; setForm(u); onSave(u)
                      }}
                      title={hasKey ? `Switch to ${label}` : `Add ${label} API key first`}
                    >
                      <span className="provider-name">
                        {key === 'openai' && '\u{1F7E2}'}{key === 'anthropic' && '\u{1F7E0}'}{key === 'google' && '\u{1F535}'}{key === 'groq' && '\u{26A1}'} {label}
                      </span>
                      <span className={`provider-status ${hasKey ? 'connected' : ''}`}>
                        {hasKey ? 'Key set' : 'No key'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* llama.cpp */}
        <div className="settings-section">
          <SectionHeader sectionKey="llamacpp" title="llama.cpp / Local Server" />
          {openSections.llamacpp && (
            <div className="settings-section-body">
              <div className="settings-row">
                <label>Endpoint</label>
                <input
                  type="text"
                  value={form.llamacppEndpoint || 'http://127.0.0.1:8080'}
                  onChange={(e) => setForm({ ...form, llamacppEndpoint: e.target.value })}
                  onBlur={() => onSave(form)}
                  placeholder="http://127.0.0.1:8080"
                />
              </div>
              <div className="settings-row">
                <label>Model</label>
                {availableLlamaCppModels.length > 0 ? (
                  <select
                    value={form.llamacppModelName || ''}
                    onChange={(e) => { const u = { ...form, llamacppModelName: e.target.value }; setForm(u); onSave(u) }}
                  >
                    <option value="">-- Select --</option>
                    {availableLlamaCppModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.llamacppModelName || ''}
                    onChange={(e) => setForm({ ...form, llamacppModelName: e.target.value })}
                    onBlur={() => onSave(form)}
                    placeholder="Click Test Connection to load models"
                  />
                )}
              </div>
              <div className="settings-row">
                <label>Binary</label>
                <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                  <input
                    type="text"
                    style={{ flex: 1 }}
                    value={form.llamacppBinaryPath || ''}
                    onChange={(e) => setForm({ ...form, llamacppBinaryPath: e.target.value })}
                    onBlur={() => onSave(form)}
                    placeholder="Path to llama-server"
                  />
                  <button className="settings-btn secondary" onClick={async () => {
                    const p = await window.electronAPI.pickLlamaCppBinary()
                    if (p) { const u = { ...form, llamacppBinaryPath: p }; setForm(u); onSave(u) }
                  }}>Browse</button>
                </div>
              </div>
              <div className="settings-row">
                <label>GGUF Model</label>
                <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                  <input
                    type="text"
                    style={{ flex: 1 }}
                    value={form.llamacppModelPath || ''}
                    onChange={(e) => setForm({ ...form, llamacppModelPath: e.target.value })}
                    onBlur={() => onSave(form)}
                    placeholder="Path to .gguf"
                  />
                  <button className="settings-btn secondary" onClick={async () => {
                    const p = await window.electronAPI.pickLlamaCppModel()
                    if (p) { const u = { ...form, llamacppModelPath: p }; setForm(u); onSave(u) }
                  }}>Browse</button>
                </div>
              </div>
              <div className="settings-row-actions">
                <button className="settings-btn secondary" onClick={async () => {
                  try {
                    const healthy = await window.electronAPI.checkLlamaCppHealth()
                    if (healthy) {
                      setConnectionStatus('ok')
                      const models = await window.electronAPI.listLlamaCppModels()
                      setAvailableLlamaCppModels(models)
                      if (models.length > 0 && !form.llamacppModelName) {
                        const u = { ...form, llamacppModelName: models[0] }; setForm(u); onSave(u)
                      }
                    } else {
                      setConnectionStatus('fail')
                      setAvailableLlamaCppModels([])
                    }
                  } catch { setConnectionStatus('fail'); setAvailableLlamaCppModels([]) }
                }}>Test Connection</button>
                <button
                  className="settings-btn secondary"
                  onClick={async () => { try { await window.electronAPI.launchLlamaCpp() } catch (e: any) { console.error(e) } }}
                  disabled={!form.llamacppBinaryPath || !form.llamacppModelPath}
                >Launch Server</button>
              </div>
            </div>
          )}
        </div>

        {/* Coding Model */}
        <div className="settings-section">
          <SectionHeader sectionKey="coding" title="Coding Model" badge={form.codingModel || form.modelName} />
          {openSections.coding && (
            <div className="settings-section-body">
              <div className="settings-row">
                <label>Provider</label>
                <select
                  value={form.codingProvider || form.activeProvider || 'ollama'}
                  onChange={(e) => { const u = { ...form, codingProvider: e.target.value as any }; setForm(u); onSave(u) }}
                >
                  <option value="ollama">Ollama (Local)</option>
                  <option value="llamacpp">llama.cpp (Local)</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                  <option value="groq">Groq</option>
                </select>
              </div>
              <div className="settings-row">
                <label>Model</label>
                {allModelOptions.length > 0 ? (
                  <select
                    value={form.codingModel || form.modelName}
                    onChange={(e) => { const u = { ...form, codingModel: e.target.value }; setForm(u); onSave(u) }}
                  >
                    <option value="">-- Select --</option>
                    {allModelOptions.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.codingModel || form.modelName}
                    onChange={(e) => setForm({ ...form, codingModel: e.target.value })}
                    onBlur={() => onSave(form)}
                    placeholder="qwen2.5-coder:7b"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Image Model */}
        <div className="settings-section">
          <SectionHeader sectionKey="image" title="Image Model" badge={form.imageModel || 'none'} />
          {openSections.image && (
            <div className="settings-section-body">
              <div className="settings-row">
                <label>Provider</label>
                <select
                  value={form.imageProvider || 'ollama'}
                  onChange={(e) => {
                    const provider = e.target.value as any
                    const currentModel = (form.imageModel || '').trim()
                    const fallbackModel = provider === 'ollama'
                      ? (availableImageModels.includes(currentModel) ? currentModel : (availableImageModels[0] || ''))
                      : currentModel
                    const u = { ...form, imageProvider: provider, imageModel: fallbackModel }; setForm(u); onSave(u)
                  }}
                >
                  <option value="ollama">Ollama</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                  <option value="groq">Groq</option>
                </select>
              </div>
              <div className="settings-row">
                <label>Model</label>
                {(form.imageProvider || 'ollama') === 'ollama' && availableImageModels.length > 0 ? (
                  <select
                    value={form.imageModel || ''}
                    onChange={(e) => { const u = { ...form, imageModel: e.target.value }; setForm(u); onSave(u) }}
                  >
                    {availableImageModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.imageModel || ''}
                    onChange={(e) => setForm({ ...form, imageModel: e.target.value })}
                    onBlur={() => onSave(form)}
                    placeholder={form.imageProvider === 'ollama' ? 'Run: ollama pull sdxl' : 'dall-e-3'}
                  />
                )}
              </div>
              <span className="settings-field-hint">
                For local image generation, install via: <code>ollama pull sdxl</code> or <code>ollama pull stable-diffusion</code>
              </span>
            </div>
          )}
        </div>

        {/* API Keys */}
        <div className="settings-section">
          <SectionHeader sectionKey="apikeys" title="API Keys" badge={Object.keys(form.apiKeys || {}).length > 0 ? `${Object.keys(form.apiKeys || {}).length} set` : undefined} />
          {openSections.apikeys && (
            <div className="settings-section-body">
              {API_PROVIDERS.map(({ key, label, placeholder }) => (
                <div key={key} className="settings-row">
                  <label>{label}</label>
                  <div className="api-key-input-row">
                    <input
                      type={showKeys[key] ? 'text' : 'password'}
                      value={form.apiKeys?.[key] || ''}
                      onChange={(e) => handleApiKeyChange(key, e.target.value)}
                      placeholder={placeholder}
                      autoComplete="off"
                    />
                    <button className="api-key-toggle" onClick={() => toggleShowKey(key)} title={showKeys[key] ? 'Hide' : 'Show'} type="button">
                      {showKeys[key] ? '\u{1F441}' : '\u{1F512}'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Instructions */}
        <div className="settings-section">
          <SectionHeader sectionKey="prompts" title="AI Instructions" />
          {openSections.prompts && (
            <div className="settings-section-body">
              {(['chat', 'coding', 'plan', 'build', 'bugfix', 'image'] as const).map(mode => (
                <div key={mode} className="settings-row">
                  <label style={{ textTransform: 'capitalize' }}>{mode}</label>
                  <textarea
                    value={form.systemPrompts?.[mode] || ''}
                    onChange={(e) => setForm({
                      ...form,
                      systemPrompts: { ...(form.systemPrompts || {} as any), [mode]: e.target.value } as any,
                    })}
                    onBlur={() => onSave(form)}
                    rows={2}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Permissions */}
        <div className="settings-section">
          <SectionHeader sectionKey="permissions" title="Permissions" />
          {openSections.permissions && (
            <div className="settings-section-body">
              {[
                { key: 'allowTerminal', label: 'Run commands', desc: 'Allow agent to execute build/test commands' },
                { key: 'allowFileWrite', label: 'File writes', desc: 'Allow agent to create and modify files' },
                { key: 'allowAICodeExec', label: 'AI code execution', desc: 'Allow AI to run generated code (dangerous)' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="permission-toggle-row">
                  <div className="permission-label">
                    <span className="permission-label-title">{label}</span>
                    <span className="permission-label-desc">{desc}</span>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={(form.permissions as any)?.[key] ?? (key === 'allowAICodeExec' ? false : true)}
                      onChange={(e) => {
                        const perms = { ...(form.permissions || { allowTerminal: true, allowFileWrite: true, allowAICodeExec: false }), [key]: e.target.checked }
                        setForm({ ...form, permissions: perms })
                        setSaved(false)
                      }}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Safety Limits */}
        <div className="settings-section">
          <SectionHeader sectionKey="safety" title="Agent Safety Limits" />
          {openSections.safety && (
            <div className="settings-section-body">
              {[
                { key: 'maxActions', label: 'Max actions', min: 1 },
                { key: 'maxFileWrites', label: 'Max file writes', min: 1 },
                { key: 'maxCommands', label: 'Max commands', min: 0 },
                { key: 'maxBytesWritten', label: 'Max bytes written', min: 1024, step: 1024 },
                { key: 'maxContractViolations', label: 'Max violations', min: 1 },
                { key: 'maxCommandTimeoutMs', label: 'Command timeout (ms)', min: 5000, step: 1000 },
              ].map(({ key, label, min, step }) => (
                <div key={key} className="settings-row">
                  <label>{label}</label>
                  <input
                    type="number"
                    min={min}
                    step={step || 1}
                    value={(agentSafety as any)[key]}
                    onChange={(e) => updateAgentSafetyField(key as any, parseInt(e.target.value, 10) || 0)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tools & Diagnostics */}
        <div className="settings-section">
          <SectionHeader sectionKey="tools" title="Diagnostics & Tools" />
          {openSections.tools && (
            <div className="settings-section-body">
              <div className="settings-info-row">
                <div className="settings-info-card">
                  <h3>Connection</h3>
                  <p>{connectionStatus === 'ok' ? 'Ollama running' : connectionStatus === 'fail' ? 'Cannot reach server' : 'Checking...'}</p>
                  <button className="settings-btn secondary" onClick={refreshConnection}>Refresh</button>
                </div>
                <div className="settings-info-card">
                  <h3>Diagnostics</h3>
                  <p>Full system check</p>
                  <button className="settings-btn secondary" onClick={async () => {
                    setTesting(true)
                    try {
                      const [diag, stats] = await Promise.all([
                        window.electronAPI.runDiagnostics(),
                        window.electronAPI.getSystemStats()
                      ])
                      setConnectionStatus(diag.serverReachable ? (diag.modelFound ? 'ok' : 'fail') : 'fail')
                      setSystemStats(stats)
                      const memUsed = ((stats.totalMem - stats.freeMem) / 1073741824).toFixed(1)
                      const memTotal = (stats.totalMem / 1073741824).toFixed(1)
                      const results = [
                        `Server: ${diag.serverReachable ? 'Reachable' : 'Offline'}`,
                        `Model found: ${diag.modelFound ? 'Yes' : 'No'}`,
                        `Models: ${diag.availableModels.length > 0 ? diag.availableModels.join(', ') : 'None'}`,
                        `Memory: ${memUsed}GB / ${memTotal}GB`,
                        `CPUs: ${stats.cpus}`,
                        diag.error ? `Error: ${diag.error}` : '',
                      ].filter(Boolean).join('\n')
                      alert(results)
                    } catch { setConnectionStatus('fail') }
                    finally { setTesting(false) }
                  }} disabled={testing}>{testing ? 'Running...' : 'Run Check'}</button>
                </div>
                <div className="settings-info-card">
                  <h3>Checkpoint</h3>
                  <p>Copy project snapshot</p>
                  <button className="settings-btn secondary" onClick={async () => {
                    try {
                      const prompt = await window.electronAPI.generateCheckpoint()
                      await navigator.clipboard.writeText(prompt)
                    } catch (e: any) { console.error(e) }
                  }}>Copy Prompt</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Guide */}
        <div className="settings-section">
          <SectionHeader sectionKey="guide" title="User Guide" />
          {openSections.guide && (
            <div className="settings-section-body user-guide">
              <h3>Getting Started</h3>
              <p>AI Agent IDE is a local-first AI coding environment. Here's how to use it:</p>

              <h4>Chat Tab</h4>
              <ul>
                <li>Ask questions, get code suggestions, generate images with <code>/image prompt</code></li>
                <li>Type <code>/</code> to see available slash commands</li>
                <li>Code blocks have action buttons: Open in Editor, Save to Files, Run in Terminal</li>
              </ul>

              <h4>Code Tab</h4>
              <ul>
                <li><strong>Editor</strong>: Monaco-powered code editor with syntax highlighting for 30+ languages</li>
                <li><strong>Explorer</strong>: Browse project files. Open a folder, then click files to edit</li>
                <li><strong>Terminal</strong>: Integrated terminal for running commands</li>
                <li><strong>AI Pane</strong>: Choose Plan/Build/Code/Bugfix mode for AI-assisted workflows</li>
              </ul>

              <h4>AI Modes</h4>
              <ul>
                <li><strong>Plan</strong>: AI creates a step-by-step plan, you approve, it builds</li>
                <li><strong>Build</strong>: AI directly implements changes in your workspace</li>
                <li><strong>Code</strong>: Quick code generation/editing in the current file</li>
                <li><strong>Bug Fix</strong>: AI analyzes and fixes issues</li>
              </ul>

              <h4>Files Tab</h4>
              <ul>
                <li>Your project library. Create projects, import files, drag & drop</li>
                <li>Double-click a project folder to open it in the Code tab</li>
                <li>Right-click for context menu (rename, delete, duplicate, etc.)</li>
              </ul>

              <h4>Keyboard Shortcuts</h4>
              <ul>
                <li><code>Ctrl+1</code> Chat | <code>Ctrl+2</code> Code | <code>Ctrl+3</code> Files</li>
                <li><code>Ctrl+N</code> New chat | <code>Ctrl+O</code> Open file | <code>Ctrl+P</code> Quick open</li>
                <li><code>Ctrl+B</code> Toggle sidebar | <code>Ctrl+,</code> Settings</li>
                <li><code>Ctrl+S</code> Save file | <code>Ctrl+Enter</code> Send message</li>
              </ul>

              <h4>Setting Up Local AI</h4>
              <ol>
                <li>Install <a href="https://ollama.ai" target="_blank" rel="noreferrer">Ollama</a> and run <code>ollama serve</code></li>
                <li>Pull a model: <code>ollama pull qwen2.5-coder:7b</code></li>
                <li>Or configure llama.cpp with a GGUF model file</li>
                <li>The app will auto-detect and connect to your local server</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
