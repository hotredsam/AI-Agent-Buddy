import type { OllamaChatMessage } from './ollama'

interface GeminiStreamChunk {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
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

export async function* sendGoogleStream(
  apiKey: string,
  model: string,
  messages: OllamaChatMessage[],
  abortSignal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const systemText = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n')

  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: systemText
        ? { parts: [{ text: systemText }] }
        : undefined,
    }),
    signal: resolveStreamSignal(abortSignal),
  })

  if (!response.ok) {
    throw new Error(`Google API error (${response.status}): ${await response.text()}`)
  }

  if (!response.body) {
    throw new Error('Google stream not available (no response body)')
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

      try {
        const chunk = JSON.parse(data) as GeminiStreamChunk
        const token = chunk.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || '')
          .join('') || ''
        if (token) {
          yield token
        }
      } catch {
        // Ignore malformed SSE chunk
      }
    }
  }
}
