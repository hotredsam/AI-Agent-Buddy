import { BrowserWindow } from 'electron'
import { randomUUID as uuidv4 } from 'crypto'
import { unloadModel } from './ollama'

export type RuntimeRequestKind = 'chat' | 'coding' | 'plan' | 'build' | 'bugfix' | 'image'
export type RuntimeRequestPhase = 'preparing' | 'requesting' | 'streaming' | 'processing'
export type RuntimeRequestOutcome = 'completed' | 'failed' | 'cancelled'

interface RuntimeRequest {
  id: string
  provider: string
  model: string
  kind: RuntimeRequestKind
  phase: RuntimeRequestPhase
  startedAt: string
  phaseUpdatedAt: string
}

export interface RuntimeActiveRequest {
  id: string
  provider: string
  model: string
  kind: RuntimeRequestKind
  phase: RuntimeRequestPhase
  startedAt: string
  phaseUpdatedAt: string
  elapsedMs: number
}

export interface RuntimeRecentRequest {
  id: string
  provider: string
  model: string
  kind: RuntimeRequestKind
  startedAt: string
  endedAt: string
  durationMs: number
  outcome: RuntimeRequestOutcome
  finalPhase: RuntimeRequestPhase
  error?: string
}

export interface RuntimeDiagnostics {
  snapshotAt: string
  activeModels: string[]
  activeRequestCount: number
  activeRequests: RuntimeActiveRequest[]
  recentRequests: RuntimeRecentRequest[]
  imageModelLoaded: boolean
  lastUnloadAt: string | null
}

const activeRequests = new Map<string, RuntimeRequest>()
const recentRequests: RuntimeRecentRequest[] = []
let lastLoadedOllamaModel: string | null = null
let imageModelLoaded = false
let lastUnloadAt: string | null = null
const MAX_RECENT_REQUESTS = 40

function nowIso(): string {
  return new Date().toISOString()
}

function broadcastDiagnostics() {
  const snapshot = getRuntimeDiagnostics()
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      if (win.isDestroyed() || win.webContents.isDestroyed()) continue
      win.webContents.send('runtime:diagnostics', snapshot)
    } catch {
      // Ignore renderer lifecycle races.
    }
  }
}

export function getRuntimeDiagnostics(): RuntimeDiagnostics {
  const requests = Array.from(activeRequests.values()).map((request) => ({
    ...request,
    elapsedMs: Math.max(0, Date.now() - new Date(request.startedAt).getTime()),
  }))
  const activeModels = Array.from(new Set(requests.map((request) => request.model)))
  return {
    snapshotAt: nowIso(),
    activeModels,
    activeRequestCount: requests.length,
    activeRequests: requests,
    recentRequests: [...recentRequests],
    imageModelLoaded,
    lastUnloadAt,
  }
}

async function unloadIfModelChanged(endpoint: string, requestedModel: string): Promise<void> {
  if (!lastLoadedOllamaModel || lastLoadedOllamaModel === requestedModel) {
    lastLoadedOllamaModel = requestedModel
    return
  }

  await unloadModel(endpoint, lastLoadedOllamaModel)
  lastUnloadAt = nowIso()
  lastLoadedOllamaModel = requestedModel
  imageModelLoaded = false
}

export async function beginRuntimeRequest(input: {
  provider: string
  model: string
  kind: RuntimeRequestKind
  endpoint?: string
  phase?: RuntimeRequestPhase
}): Promise<string> {
  if (input.provider === 'ollama') {
    const hasActiveOllamaRequest = Array.from(activeRequests.values()).some((request) => request.provider === 'ollama')
    if (hasActiveOllamaRequest) {
      throw new Error('Another Ollama request is already running. Wait for it to finish or cancel it first.')
    }
    await unloadIfModelChanged(input.endpoint || 'http://127.0.0.1:11434', input.model)
    if (input.kind === 'image') {
      imageModelLoaded = true
    }
  }

  const id = uuidv4()
  const now = nowIso()
  activeRequests.set(id, {
    id,
    provider: input.provider,
    model: input.model,
    kind: input.kind,
    phase: input.phase || 'preparing',
    startedAt: now,
    phaseUpdatedAt: now,
  })
  broadcastDiagnostics()
  return id
}

export function updateRuntimeRequestPhase(id: string, phase: RuntimeRequestPhase): void {
  const current = activeRequests.get(id)
  if (!current || current.phase === phase) return
  current.phase = phase
  current.phaseUpdatedAt = nowIso()
  activeRequests.set(id, current)
  broadcastDiagnostics()
}

export function endRuntimeRequest(
  id: string,
  input?: { outcome?: RuntimeRequestOutcome; error?: string }
): void {
  const request = activeRequests.get(id)
  if (!request) return
  activeRequests.delete(id)

  const endedAt = nowIso()
  const durationMs = Math.max(0, new Date(endedAt).getTime() - new Date(request.startedAt).getTime())
  recentRequests.unshift({
    id: request.id,
    provider: request.provider,
    model: request.model,
    kind: request.kind,
    startedAt: request.startedAt,
    endedAt,
    durationMs,
    outcome: input?.outcome || 'completed',
    finalPhase: request.phase,
    error: input?.error,
  })
  if (recentRequests.length > MAX_RECENT_REQUESTS) {
    recentRequests.length = MAX_RECENT_REQUESTS
  }
  broadcastDiagnostics()
}

export async function unloadTrackedModel(endpoint: string): Promise<void> {
  if (!lastLoadedOllamaModel) return
  await unloadModel(endpoint, lastLoadedOllamaModel)
  lastUnloadAt = nowIso()
  lastLoadedOllamaModel = null
  imageModelLoaded = false
  broadcastDiagnostics()
}
