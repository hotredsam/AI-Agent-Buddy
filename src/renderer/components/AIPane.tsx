import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AgentEvent,
  AgentMode,
  AgentTask,
  RuntimeDiagnostics,
  Settings,
} from '../types'

type PaneState = 'idle' | 'thinking' | 'writing' | 'testing' | 'done' | 'error'

interface AIPaneProps {
  settings: Settings
  modelOptions?: string[]
  workspaceRootPath: string | null
  onWorkspaceRootPathChange?: (path: string) => void
  activeFileContent: string
  onSaveSettings: (next: Settings) => void
  onApplyToEditor: (content: string) => void
  onNotify?: (text: string, type?: 'error' | 'warning' | 'success') => void
}

interface CodingResponse {
  id: string
  text: string
  reasoning: string[]
  createdAt: string
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString()
}

function paneStateLabel(state: PaneState): string {
  if (state === 'thinking') return 'Thinking...'
  if (state === 'writing') return 'Writing...'
  if (state === 'testing') return 'Testing...'
  if (state === 'done') return 'Done'
  if (state === 'error') return 'Error'
  return 'Idle'
}

function parseReasoning(text: string): { visibleText: string; reasoning: string[] } {
  const reasoning: string[] = []
  const visible = text.replace(/<think>([\s\S]*?)<\/think>/gi, (_all, block) => {
    const value = String(block || '').trim()
    if (value) reasoning.push(value)
    return ''
  }).trim()
  return {
    visibleText: visible || text.replace(/<\/?think>/gi, '').trim(),
    reasoning,
  }
}

function extractPrimaryCode(text: string): string {
  const match = text.match(/```[\w-]*\n([\s\S]*?)```/)
  return (match ? match[1] : text).trim()
}

function stepMarker(status: AgentTask['steps'][number]['status']): string {
  if (status === 'completed') return 'ok'
  if (status === 'in_progress') return '...'
  if (status === 'failed') return 'x'
  return 'o'
}

export default function AIPane({
  settings,
  modelOptions = [],
  workspaceRootPath,
  onWorkspaceRootPathChange,
  activeFileContent,
  onSaveSettings,
  onApplyToEditor,
  onNotify,
}: AIPaneProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState<AgentMode>('plan')
  const [autoRunPipeline, setAutoRunPipeline] = useState(true)
  const [paneState, setPaneState] = useState<PaneState>('idle')
  const [busy, setBusy] = useState(false)
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [codingResponses, setCodingResponses] = useState<CodingResponse[]>([])
  const [expandedReasoningIds, setExpandedReasoningIds] = useState<Record<string, boolean>>({})
  const [runtimeDiagnostics, setRuntimeDiagnostics] = useState<RuntimeDiagnostics | null>(null)
  const paneRef = useRef<HTMLElement | null>(null)

  const provider = (settings.codingProvider || settings.activeProvider || 'ollama') as NonNullable<Settings['activeProvider']>
  const model = settings.codingModel || settings.modelName

  const refreshLayout = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'))
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 120)
    })
  }, [])

  useEffect(() => {
    let mounted = true
    window.electronAPI.listAgentTasks().then((list) => {
      if (!mounted) return
      setTasks(list)
      if (!activeTaskId && list.length > 0) {
        setActiveTaskId(list[0].id)
      }
    }).catch(() => {})

    const unsubUpdate = window.electronAPI.onAgentUpdate((updatedTasks) => {
      setTasks(updatedTasks)
      if (updatedTasks.length === 0) {
        setActiveTaskId(null)
        return
      }
      setActiveTaskId((prev) => prev && updatedTasks.some((task) => task.id === prev) ? prev : updatedTasks[0].id)
    })

    const unsubEvent = window.electronAPI.onAgentEvent((event: AgentEvent) => {
      if (activeTaskId && event.taskId !== activeTaskId) return
      if (event.type === 'planning_started' || event.type === 'task_created') {
        setPaneState('thinking')
      } else if (event.type === 'build_started' || event.type === 'step_started' || event.type === 'file_written') {
        setPaneState('writing')
      } else if (event.type === 'testing_started' || event.type === 'test_command_start' || event.type === 'test_output') {
        setPaneState('testing')
      } else if (event.type === 'task_completed') {
        setPaneState('done')
      } else if (event.type === 'task_failed') {
        setPaneState('error')
      } else if (event.type === 'task_cancelled') {
        setPaneState('idle')
      }
    })

    return () => {
      mounted = false
      unsubUpdate()
      unsubEvent()
    }
  }, [activeTaskId])

  useEffect(() => {
    let mounted = true
    window.electronAPI.getRuntimeDiagnostics()
      .then((snapshot) => {
        if (mounted) setRuntimeDiagnostics(snapshot)
      })
      .catch(() => {})

    const unsubRuntime = window.electronAPI.onRuntimeDiagnostics((snapshot) => {
      setRuntimeDiagnostics(snapshot)
    })

    return () => {
      mounted = false
      unsubRuntime()
    }
  }, [])

  useEffect(() => {
    refreshLayout()
  }, [collapsed, refreshLayout])

  useEffect(() => {
    const unsub = window.electronAPI.onWindowStateChanged(() => {
      refreshLayout()
    })
    return () => unsub()
  }, [refreshLayout])

  useEffect(() => {
    if (!paneRef.current || typeof ResizeObserver !== 'function') return
    const observer = new ResizeObserver(() => {
      refreshLayout()
    })
    observer.observe(paneRef.current)
    return () => observer.disconnect()
  }, [collapsed, refreshLayout])

  const activeTask = useMemo(() => {
    if (!activeTaskId) return null
    return tasks.find((task) => task.id === activeTaskId) || null
  }, [activeTaskId, tasks])

  useEffect(() => {
    if (!activeTask) return
    if (activeTask.phase === 'thinking') setPaneState('thinking')
    else if (activeTask.phase === 'writing') setPaneState('writing')
    else if (activeTask.phase === 'testing') setPaneState('testing')
    else if (activeTask.phase === 'error') setPaneState('error')
    else if (activeTask.phase === 'done') {
      if (activeTask.status === 'failed') setPaneState('error')
      else if (activeTask.status === 'completed') setPaneState('done')
      else setPaneState('idle')
    }
  }, [activeTask])

  const handleRun = async () => {
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt || busy) return

    if (mode === 'coding') {
      setBusy(true)
      setPaneState('thinking')
      try {
        const result = await window.electronAPI.generateCode({
          prompt: trimmedPrompt,
          context: activeFileContent || '',
          provider,
          model,
          mode: 'coding',
        })
        if (!result.text) {
          throw new Error(result.error || 'AI coding request failed.')
        }
        setPaneState('writing')
        const parsed = parseReasoning(result.text)
        const response: CodingResponse = {
          id: `coding-${Date.now()}`,
          text: parsed.visibleText,
          reasoning: parsed.reasoning,
          createdAt: new Date().toISOString(),
        }
        setCodingResponses((prev) => [response, ...prev].slice(0, 8))
        const code = extractPrimaryCode(parsed.visibleText)
        if (code) {
          onApplyToEditor(code)
          onNotify?.('Applied coding output to editor.', 'success')
        }
        setPaneState('done')
        setPrompt('')
      } catch (error: any) {
        setPaneState('error')
        onNotify?.(error?.message || 'AI coding request failed.')
      } finally {
        setBusy(false)
      }
      return
    }

    if ((mode === 'build' || mode === 'bugfix') && !workspaceRootPath) {
      setPaneState('error')
      onNotify?.('Open a project first.', 'warning')
      return
    }

    setBusy(true)
    setPaneState('thinking')
    try {
      const task = await window.electronAPI.createAgentTask({
        goal: trimmedPrompt,
        mode,
        workspaceRootPath: workspaceRootPath || null,
        autoRunPipeline,
      })
      setActiveTaskId(task.id)
      setPrompt('')
      onNotify?.('Agent task started.', 'success')
    } catch (error: any) {
      setPaneState('error')
      onNotify?.(error?.message || 'Failed to create agent task.')
    } finally {
      setBusy(false)
    }
  }

  const handleApprove = async () => {
    if (!activeTask || activeTask.status !== 'waiting_approval') return
    try {
      setPaneState('writing')
      const approvedTask = await window.electronAPI.approveAgentTask(activeTask.id, workspaceRootPath || null)
      if (approvedTask.workspaceRootPath && approvedTask.workspaceRootPath !== workspaceRootPath) {
        onWorkspaceRootPathChange?.(approvedTask.workspaceRootPath)
        onNotify?.(`Workspace ready: ${approvedTask.workspaceRootPath}`, 'success')
      }
      onNotify?.('Plan approved. Starting build...', 'success')
    } catch (error: any) {
      setPaneState('error')
      onNotify?.(error?.message || 'Failed to approve task.')
    }
  }

  const handleCancel = async () => {
    if (!activeTask) return
    try {
      await window.electronAPI.cancelAgentTask(activeTask.id)
      setPaneState('idle')
      onNotify?.('Task cancelled.', 'warning')
    } catch (error: any) {
      setPaneState('error')
      onNotify?.(error?.message || 'Failed to cancel task.')
    }
  }

  if (collapsed) {
    return (
      <div
        className="ai-pane ai-pane-collapsed"
        ref={(node) => {
          paneRef.current = node
        }}
      >
        <button className="ai-pane-collapse-btn" onClick={() => setCollapsed(false)} title="Expand AI Pane">
          {'<'}
        </button>
      </div>
    )
  }

  return (
    <aside
      className="ai-pane"
      ref={(node) => {
        paneRef.current = node
      }}
    >
      <div className="ai-pane-header">
        <div className="ai-pane-title-wrap">
          <h3>AI Assistant</h3>
          <span className={`ai-pane-status ${paneState}`}>{paneStateLabel(paneState)}</span>
        </div>
        <button className="ai-pane-collapse-btn" onClick={() => setCollapsed(true)} title="Collapse AI Pane">
          {'>'}
        </button>
      </div>

      <div className="ai-pane-scroll">
        <div className="ai-pane-meta">
          <span>Workspace: {workspaceRootPath || 'None (open a project first)'}</span>
        </div>

        <section className="ai-pane-section ai-runtime-section">
          <div className="ai-pane-section-header">
            <strong>Runtime</strong>
          </div>
          <div className="ai-runtime-grid">
            <span>Active requests: {runtimeDiagnostics?.activeRequestCount ?? 0}</span>
            <span>Active models: {runtimeDiagnostics?.activeModels.join(', ') || 'none'}</span>
            <span>Image model loaded: {runtimeDiagnostics?.imageModelLoaded ? 'yes' : 'no'}</span>
            <span>Last unload: {runtimeDiagnostics?.lastUnloadAt ? formatTime(runtimeDiagnostics.lastUnloadAt) : 'never'}</span>
          </div>
          {runtimeDiagnostics && runtimeDiagnostics.activeRequests.length > 0 && (
            <div className="ai-runtime-requests">
              {runtimeDiagnostics.activeRequests.map((request) => (
                <div key={request.id} className="ai-runtime-request-line">
                  <span>{request.provider}/{request.model}</span>
                  <span>{request.kind}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {activeTask && (
          <section className="ai-pane-section">
            <div className="ai-pane-section-header">
              <strong>Current Task</strong>
              <button className="ai-pane-link-btn" onClick={() => setActiveTaskId(null)} title="Clear active task selection">
                Clear
              </button>
            </div>
            <div className="ai-task-goal">{activeTask.goal}</div>
            <div className="ai-task-status-row">
              <span className="ai-task-chip">{activeTask.mode}</span>
              <span className="ai-task-chip">{activeTask.status.replace('_', ' ')}</span>
              <span className="ai-task-chip">{formatTime(activeTask.createdAt)}</span>
            </div>

            {activeTask.plan && (
              <div className="ai-task-plan">
                <p>{activeTask.plan}</p>
                {activeTask.steps.length > 0 && (
                  <ul className="ai-task-steps">
                    {activeTask.steps.map((step) => (
                      <li key={step.id} className={`ai-task-step ${step.status}`}>
                        <span className="marker">{stepMarker(step.status)}</span>
                        <span>{step.description}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="ai-task-actions">
              <button
                className="ai-pane-run-btn"
                disabled={activeTask.status !== 'waiting_approval'}
                onClick={handleApprove}
              >
                Approve Plan
              </button>
              <button
                className="ai-pane-secondary-btn"
                disabled={['completed', 'failed', 'cancelled'].includes(activeTask.status)}
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        {activeTask && activeTask.fileWrites.length > 0 && (
          <section className="ai-pane-section">
            <div className="ai-pane-section-header">
              <strong>File Writes</strong>
            </div>
            <div className="ai-pane-filewrites">
              {[...activeTask.fileWrites].reverse().slice(0, 40).map((write) => (
                <div key={write.id} className="ai-write-card">
                  <div className="ai-write-meta">
                    <span>{write.path}</span>
                    <span>{formatTime(write.timestamp)}</span>
                  </div>
                  <div className="ai-write-bytes">
                    delta {write.bytesChanged >= 0 ? '+' : ''}{write.bytesChanged} bytes
                  </div>
                  <pre>{write.preview}</pre>
                </div>
              ))}
            </div>
          </section>
        )}

        {codingResponses.length > 0 && (
          <section className="ai-pane-section">
            <div className="ai-pane-section-header">
              <strong>Coding Output</strong>
            </div>
            {codingResponses.map((response) => (
              <div key={response.id} className="ai-coding-response">
                <div className="ai-write-meta">
                  <span>Response</span>
                  <span>{formatTime(response.createdAt)}</span>
                </div>
                {response.reasoning.length > 0 && (
                  <div className="ai-reasoning-list">
                    {response.reasoning.map((reasoning, index) => {
                      const key = `${response.id}-${index}`
                      const expanded = !!expandedReasoningIds[key]
                      return (
                        <div key={key} className="ai-reasoning-block">
                          <button
                            className="ai-reasoning-toggle"
                            onClick={() => setExpandedReasoningIds((prev) => ({ ...prev, [key]: !expanded }))}
                          >
                            Reasoning {expanded ? 'v' : '>'}
                          </button>
                          {expanded && <pre>{reasoning}</pre>}
                        </div>
                      )
                    })}
                  </div>
                )}
                <pre>{response.text}</pre>
              </div>
            ))}
          </section>
        )}

        {activeTask && (
          <section className="ai-pane-section ai-pane-log-section">
            <div className="ai-pane-section-header">
              <strong>Logs</strong>
            </div>
            <div className="ai-pane-logs">
              {activeTask.logs.length === 0 && (
                <div className="ai-pane-empty">No logs yet.</div>
              )}
              {[...activeTask.logs].slice(-400).map((log) => (
                <div key={log.id} className={`ai-log-line ${log.level}`}>
                  <span className="ts">{formatTime(log.timestamp)}</span>
                  <pre className="msg">{log.message}</pre>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="ai-pane-footer">
        <div className="ai-pane-controls">
          <select className="ai-pane-select" value={mode} onChange={(e) => setMode(e.target.value as AgentMode)}>
            <option value="plan">Plan</option>
            <option value="build">Build</option>
            <option value="coding">Code</option>
            <option value="bugfix">Bug Fix</option>
          </select>
          <select
            className="ai-pane-select"
            value={provider}
            onChange={(e) => onSaveSettings({ ...settings, codingProvider: e.target.value as any })}
          >
            <option value="ollama">Ollama</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
            <option value="groq">Groq</option>
          </select>
          <input
            className="ai-pane-model"
            value={model}
            onChange={(e) => onSaveSettings({ ...settings, codingModel: e.target.value })}
            placeholder="coding model"
            list="ai-pane-model-options"
          />
          {modelOptions.length > 0 && (
            <datalist id="ai-pane-model-options">
              {modelOptions.map((item) => <option key={item} value={item} />)}
            </datalist>
          )}
        </div>

        <label className="ai-pane-toggle">
          <input type="checkbox" checked={autoRunPipeline} onChange={(e) => setAutoRunPipeline(e.target.checked)} />
          <span>Auto-run Plan - Approve - Build - Test</span>
        </label>

        <div className="ai-pane-input-wrap">
          <textarea
            className="ai-pane-input"
            placeholder="Describe what to plan, build, or fix..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleRun()
              }
            }}
          />
          <button className={`ai-pane-run-btn ${busy ? 'busy' : ''}`} disabled={busy || !prompt.trim()} onClick={handleRun}>
            {busy ? 'Working...' : 'Send'}
          </button>
        </div>
      </div>
    </aside>
  )
}
