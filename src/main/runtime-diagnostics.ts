import { BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { unloadModel } from './ollama'

export type RuntimeRequestKind = 'chat' | 'coding' | 'plan' | 'build' | 'bugfix' | 'image'

interface RuntimeRequest {
  id: string
  provider: string
  model: string
  kind: RuntimeRequestKind
  startedAt: string
}

export interface RuntimeDiagnostics {
  activeModels: string[]
  activeRequestCount: number
  activeRequests: Array<{
    id: string
    provider: string
    model: string
    kind: RuntimeRequestKind
    startedAt: string
  }>
  imageModelLoaded: boolean
  lastUnloadAt: string | null
}

const activeRequests = new Map<string, RuntimeRequest>()
let lastLoadedOllamaModel: string | null = null
let imageModelLoaded = false
let lastUnloadAt: string | null = null

function nowIso(): string {
  return new Date().toISOString()
}

function broadcastDiagnostics() {
  const snapshot = getRuntimeDiagnostics()
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('runtime:diagnostics', snapshot)
  }
}

export function getRuntimeDiagnostics(): RuntimeDiagnostics {
  const requests = Array.from(activeRequests.values())
  const activeModels = Array.from(new Set(requests.map((request) => request.model)))
  return {
    activeModels,
    activeRequestCount: requests.length,
    activeRequests: requests,
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
  activeRequests.set(id, {
    id,
    provider: input.provider,
    model: input.model,
    kind: input.kind,
    startedAt: nowIso(),
  })
  broadcastDiagnostics()
  return id
}

export function endRuntimeRequest(id: string): void {
  if (!activeRequests.has(id)) return
  activeRequests.delete(id)
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
