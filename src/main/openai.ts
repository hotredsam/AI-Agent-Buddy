import type { OllamaChatMessage } from './ollama'

interface OpenAIStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string
    }
  }>
}

export async function* sendOpenAIStream(
  apiKey: string,
  model: string,
  messages: OllamaChatMessage[]
): AsyncGenerator<string, void, unknown> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
    signal: AbortSignal.timeout(120000),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error (${response.status}): ${await response.text()}`)
  }

  if (!response.body) {
    throw new Error('OpenAI stream not available (no response body)')
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
        const chunk = JSON.parse(data) as OpenAIStreamChunk
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
