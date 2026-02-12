import type { OllamaChatMessage } from './ollama'

interface AnthropicStreamChunk {
  type?: string
  delta?: {
    text?: string
  }
}

export async function* sendAnthropicStream(
  apiKey: string,
  model: string,
  messages: OllamaChatMessage[]
): AsyncGenerator<string, void, unknown> {
  const systemMessages = messages.filter((m) => m.role === 'system').map((m) => m.content)
  const chatMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: [{ type: 'text', text: m.content }],
    }))

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemMessages.length > 0 ? systemMessages.join('\n\n') : undefined,
      messages: chatMessages,
      stream: true,
    }),
    signal: AbortSignal.timeout(120000),
  })

  if (!response.ok) {
    throw new Error(`Anthropic API error (${response.status}): ${await response.text()}`)
  }

  if (!response.body) {
    throw new Error('Anthropic stream not available (no response body)')
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
        const chunk = JSON.parse(data) as AnthropicStreamChunk
        if (chunk.type === 'content_block_delta') {
          const token = chunk.delta?.text
          if (token) {
            yield token
          }
        }
      } catch {
        // Ignore malformed SSE chunk
      }
    }
  }
}
