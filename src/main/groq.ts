import type { OllamaChatMessage } from './ollama'

interface GroqStreamChunk {
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

export async function* sendGroqStream(
  apiKey: string,
  model: string,
  messages: OllamaChatMessage[],
  abortSignal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    }),
    signal: resolveStreamSignal(abortSignal),
  })

  if (!response.ok) {
    throw new Error(`Groq API error (${response.status}): ${await response.text()}`)
  }

  if (!response.body) {
    throw new Error('Groq stream not available (no response body)')
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
        const chunk = JSON.parse(data) as GroqStreamChunk
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
