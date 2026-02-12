import React, { useEffect, useRef } from 'react'
import type { Message } from '../types'

interface ChatPaneProps {
  messages: Message[]
  streamingText: string
  isStreaming: boolean
}

/**
 * Lightweight inline markdown renderer.
 * Handles: code blocks (```), inline code (`), bold (**), italic (*).
 * Returns an array of React nodes.
 */
function renderMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []

  // Split by fenced code blocks first
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Render text before this code block
    if (match.index > lastIndex) {
      nodes.push(...renderInline(text.slice(lastIndex, match.index), nodes.length))
    }
    // Render code block
    nodes.push(
      <pre key={`cb-${nodes.length}`}>
        <code>{match[2]}</code>
      </pre>
    )
    lastIndex = match.index + match[0].length
  }

  // Render remaining text after last code block
  if (lastIndex < text.length) {
    nodes.push(...renderInline(text.slice(lastIndex), nodes.length))
  }

  return nodes
}

function renderInline(text: string, keyOffset: number): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Process inline patterns: bold (**text**), italic (*text*), inline code (`text`)
  const inlineRegex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g
  let last = 0
  let m: RegExpExecArray | null

  while ((m = inlineRegex.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index))
    }
    if (m[1]) {
      // Bold
      nodes.push(<strong key={`b-${keyOffset}-${m.index}`}>{m[2]}</strong>)
    } else if (m[3]) {
      // Italic
      nodes.push(<em key={`i-${keyOffset}-${m.index}`}>{m[4]}</em>)
    } else if (m[5]) {
      // Inline code
      nodes.push(<code key={`c-${keyOffset}-${m.index}`}>{m[6]}</code>)
    }
    last = m.index + m[0].length
  }

  if (last < text.length) {
    nodes.push(text.slice(last))
  }

  return nodes
}

export default function ChatPane({ messages, streamingText, isStreaming }: ChatPaneProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="chat-pane">
        <div className="chat-empty">
          <span className="icon">&#x1F4AC;</span>
          <p>Start a conversation</p>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-pane">
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message-row ${msg.role}`}>
            <div className="message-bubble">
              {renderMarkdown(msg.content)}
            </div>
          </div>
        ))}

        {isStreaming && streamingText && (
          <div className="message-row assistant">
            <div className="message-bubble">
              {renderMarkdown(streamingText)}
              <span className="streaming-cursor" />
            </div>
          </div>
        )}

        {isStreaming && !streamingText && (
          <div className="message-row assistant">
            <div className="message-bubble">
              <span className="streaming-cursor" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
