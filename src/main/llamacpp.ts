import type { OllamaChatMessage } from './ollama'

interface LlamaCppStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string
    }
  }>
}

function resolveStreamSignal(abortSignal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(600000)
  const anyFn = (AbortSignal as any).any as ((signals: AbortSignal[]) => AbortSignal) | undefined
  if (!abortSignal || typeof anyFn !== 'function') {
    return abortSignal || timeoutSignal
  }
  return anyFn([timeoutSignal, abortSignal])
}

export async function* sendLlamaCppStream(
  endpoint: string,
  model: string,
  messages: OllamaChatMessage[],
  abortSignal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const response = await fetch(`${endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    }),
    signal: resolveStreamSignal(abortSignal),
  })

  if (!response.ok) {
    throw new Error(`llama.cpp server error (${response.status}): ${await response.text()}`)
  }

  if (!response.body) {
    throw new Error('llama.cpp stream not available (no response body)')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() || ''

    for (const event of events) {
      const line = event
        .split('\n')
        .find((l) => l.startsWith('data:'))

      if (!line) continue
      const data = line.slice(5).trim()
      if (!data) continue
      if (data === '[DONE]') return

      try {
        const chunk = JSON.parse(data) as LlamaCppStreamChunk
        const token = chunk.choices?.[0]?.delta?.content
        if (token) {
          yield token
        }
      } catch {
        // Ignore malformed SSE chunk
      }
    }
  }
}

export async function checkLlamaCppHealth(endpoint: string): Promise<boolean> {
  try {
    const response = await fetch(`${endpoint}/health`, {
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function listLlamaCppModels(endpoint: string): Promise<string[]> {
  try {
    const response = await fetch(`${endpoint}/v1/models`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return []
    const data: any = await response.json()
    return data?.data?.map((m: any) => m.id) || []
  } catch {
    return []
  }
}
