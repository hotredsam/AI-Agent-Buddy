// --- Ollama API Integration ---
// Uses native fetch (Node 18+) to communicate with Ollama's REST API.
// Supports streaming chat responses and automatic context window fallback.

export interface OllamaChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface OllamaStreamChunk {
  model: string
  created_at: string
  message: {
    role: string
    content: string
  }
  done: boolean
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  eval_count?: number
  eval_duration?: number
}

// Context window fallback sizes to try if the requested numCtx fails
const CTX_FALLBACKS = [32768, 16384, 8192, 4096, 2048]

export interface StreamMeta {
  requestedCtx: number
  effectiveCtx: number
  wasClamped: boolean
}

/**
 * Sends a chat message to Ollama and streams back tokens via an async generator.
 * If the requested numCtx causes an error, it retries with progressively smaller values.
 * The `onMeta` callback is called once streaming begins successfully, reporting the
 * effective context window (which may differ from requested if clamping occurred).
 */
export async function* sendMessageStream(
  endpoint: string,
  model: string,
  messages: OllamaChatMessage[],
  numCtx: number,
  onMeta?: (meta: StreamMeta) => void
): AsyncGenerator<string, void, unknown> {
  const url = `${endpoint}/api/chat`

  // Build the list of numCtx values to try: requested first, then fallbacks
  const ctxValuesToTry = [numCtx, ...CTX_FALLBACKS.filter((v) => v < numCtx)]

  let lastError: Error | null = null

  for (const ctx of ctxValuesToTry) {
    try {
      const body = JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        options: {
          num_ctx: ctx,
        },
      })

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(120000), // 2 min timeout for model loading
      })

      if (!response.ok) {
        const errorText = await response.text()
        // Check if this is a context window related error
        if (isContextWindowError(errorText) && ctx !== ctxValuesToTry[ctxValuesToTry.length - 1]) {
          console.warn(
            `Ollama rejected num_ctx=${ctx}, trying smaller context window...`
          )
          lastError = new Error(errorText)
          continue
        }
        throw new Error(`Ollama API error (${response.status}): ${errorText}`)
      }

      if (!response.body) {
        throw new Error('Response body is null - streaming not supported')
      }

      // Report effective context info
      if (onMeta) {
        onMeta({
          requestedCtx: numCtx,
          effectiveCtx: ctx,
          wasClamped: ctx !== numCtx,
        })
      }

      // Stream the response using async iteration over the ReadableStream
      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })

        // Process complete lines (newline-delimited JSON)
        const lines = buffer.split('\n')
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          try {
            const chunk: OllamaStreamChunk = JSON.parse(trimmed)

            if (chunk.message && chunk.message.content) {
              yield chunk.message.content
            }

            if (chunk.done) {
              return
            }
          } catch {
            // Skip malformed JSON lines
            console.warn('Failed to parse Ollama stream chunk:', trimmed)
          }
        }
      }

      // Process any remaining data in the buffer
      if (buffer.trim()) {
        try {
          const chunk: OllamaStreamChunk = JSON.parse(buffer.trim())
          if (chunk.message && chunk.message.content) {
            yield chunk.message.content
          }
        } catch {
          // Ignore trailing data
        }
      }

      // If we got here, streaming succeeded - return
      return

    } catch (error) {
      lastError = error as Error

      // If this looks like a context window error and we have more sizes to try, continue
      if (
        isContextWindowError(lastError.message) &&
        ctx !== ctxValuesToTry[ctxValuesToTry.length - 1]
      ) {
        console.warn(
          `Ollama failed with num_ctx=${ctx}: ${lastError.message}. Retrying...`
        )
        continue
      }

      // Otherwise, throw
      throw lastError
    }
  }

  // If we exhausted all context sizes, throw the last error
  if (lastError) {
    throw lastError
  }
}

/**
 * Checks if an error message indicates a context window size problem.
 */
function isContextWindowError(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase()
  return (
    lower.includes('context') ||
    lower.includes('num_ctx') ||
    lower.includes('memory') ||
    lower.includes('out of memory') ||
    lower.includes('oom') ||
    lower.includes('too large') ||
    lower.includes('exceed') ||
    lower.includes('not enough') ||
    lower.includes('resource limitation') ||
    lower.includes('failed to load') ||
    lower.includes('internal error') ||
    lower.includes('insufficient')
  )
}

/**
 * Checks if the Ollama server is reachable by pinging /api/tags.
 * Returns true if healthy, false otherwise.
 */
export async function checkHealth(endpoint: string): Promise<boolean> {
  try {
    const response = await fetch(`${endpoint}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Lists all locally available Ollama models.
 */
export async function listModels(endpoint: string): Promise<string[]> {
  try {
    const response = await fetch(`${endpoint}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return []
    const data: any = await response.json()
    if (data && Array.isArray(data.models)) {
      return data.models.map((m: any) => m.name || m.model || '')
        .filter((n: string) => n.length > 0)
    }
    return []
  } catch {
    return []
  }
}

/**
 * Unloads the currently loaded model from Ollama to free GPU/RAM.
 * Called on app quit to prevent the model lingering in memory.
 */
export async function unloadModel(endpoint: string, model: string): Promise<void> {
  try {
    await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, keep_alive: 0 }),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    // Best-effort: if Ollama is already gone, ignore
  }
}

/**
 * Runs a full diagnostic check on Ollama:
 * - Is the server reachable?
 * - What models are available?
 * - Is the requested model available?
 */
export async function runDiagnostics(endpoint: string, modelName: string): Promise<{
  serverReachable: boolean
  availableModels: string[]
  modelFound: boolean
  error: string | null
}> {
  const result = {
    serverReachable: false,
    availableModels: [] as string[],
    modelFound: false,
    error: null as string | null,
  }

  try {
    result.serverReachable = await checkHealth(endpoint)
    if (!result.serverReachable) {
      result.error = `Ollama server not reachable at ${endpoint}. Make sure Ollama is running (ollama serve).`
      return result
    }

    result.availableModels = await listModels(endpoint)
    result.modelFound = result.availableModels.some(
      (m) => m === modelName || m.startsWith(modelName + ':')
    )

    if (!result.modelFound && result.availableModels.length === 0) {
      result.error = `No models found. Pull a model with: ollama pull ${modelName}`
    } else if (!result.modelFound) {
      result.error = `Model "${modelName}" not found. Available: ${result.availableModels.join(', ')}. Pull it with: ollama pull ${modelName}`
    }

    return result
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'Unknown diagnostics error'
    return result
  }
}

export async function pullModel(endpoint: string, modelName: string): Promise<boolean> {
  try {
    const response = await fetch(`${endpoint}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: false }),
      signal: AbortSignal.timeout(600000),
    })
    return response.ok
  } catch {
    return false
  }
}
