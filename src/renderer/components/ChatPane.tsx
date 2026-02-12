import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { Message } from '../types'

interface ChatPaneProps {
  messages: Message[]
  streamingText: string
  isStreaming: boolean
  contextInfo?: {
    requestedCtx: number
    effectiveCtx: number
    wasClamped: boolean
  } | null
  modelName?: string
  agentEmoji?: string
  onSendToEditor?: (code: string) => void
  onRunInTerminal?: (command: string) => void
}

/**
 * Lightweight inline markdown renderer.
 * Handles: code blocks (```), inline code (`), bold (**), italic (*),
 * blockquotes (>), unordered lists (- or *), ordered lists (1.).
 * Returns an array of React nodes.
 */
function renderMarkdown(
  text: string,
  onSendToEditor?: (code: string) => void,
  onRunInTerminal?: (command: string) => void,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = []

  // Split by fenced code blocks first
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Render text before this code block
    if (match.index > lastIndex) {
      nodes.push(...renderBlocks(text.slice(lastIndex, match.index), nodes.length))
    }
    // Render code block with copy button + editor/terminal actions
    const lang = match[1] || ''
    const code = match[2]
    nodes.push(
      <CodeBlock
        key={`cb-${nodes.length}`}
        language={lang}
        code={code}
        onSendToEditor={onSendToEditor}
        onRunInTerminal={onRunInTerminal}
      />
    )
    lastIndex = match.index + match[0].length
  }

  // Render remaining text after last code block
  if (lastIndex < text.length) {
    nodes.push(...renderBlocks(text.slice(lastIndex), nodes.length))
  }

  return nodes
}

/**
 * Processes block-level elements: blockquotes, lists, then inline
 */
function renderBlocks(text: string, keyOffset: number): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const lines = text.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2))
        i++
      }
      nodes.push(
        <blockquote key={`bq-${keyOffset}-${i}`} className="md-blockquote">
          {renderInline(quoteLines.join('\n'), keyOffset + i)}
        </blockquote>
      )
      continue
    }

    // Unordered list (- or * prefix)
    if (/^[\-\*]\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[\-\*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[\-\*]\s/, ''))
        i++
      }
      nodes.push(
        <ul key={`ul-${keyOffset}-${i}`} className="md-list">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, keyOffset + i + idx)}</li>
          ))}
        </ul>
      )
      continue
    }

    // Ordered list (1. 2. etc)
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''))
        i++
      }
      nodes.push(
        <ol key={`ol-${keyOffset}-${i}`} className="md-list">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, keyOffset + i + idx)}</li>
          ))}
        </ol>
      )
      continue
    }

    // Regular text — pass through inline renderer
    if (line.trim()) {
      nodes.push(
        <span key={`ln-${keyOffset}-${i}`}>
          {renderInline(line, keyOffset + i)}
        </span>
      )
      if (i < lines.length - 1) {
        nodes.push(<br key={`br-${keyOffset}-${i}`} />)
      }
    } else if (i > 0 && i < lines.length - 1) {
      nodes.push(<br key={`br-${keyOffset}-${i}`} />)
    }
    i++
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

/**
 * Code block component with copy-to-clipboard, send-to-editor, and run buttons
 */
function CodeBlock({ language, code, onSendToEditor, onRunInTerminal }: {
  language: string
  code: string
  onSendToEditor?: (code: string) => void
  onRunInTerminal?: (command: string) => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback silently
    }
  }

  // Detect if this looks like a terminal command (shell, bash, no lang, or single-line)
  const isCommand = ['sh', 'bash', 'shell', 'cmd', 'powershell', 'ps1', 'bat', 'terminal'].includes(language.toLowerCase())
    || (!language && code.split('\n').filter(l => l.trim()).length <= 3)

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        {language && <span className="code-block-lang">{language}</span>}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {onSendToEditor && !isCommand && (
            <button className="code-block-copy" onClick={() => onSendToEditor(code)} title="Send to Editor">
              {'\u{1F4DD}'} Editor
            </button>
          )}
          {onRunInTerminal && isCommand && (
            <button className="code-block-copy" onClick={() => onRunInTerminal(code.trim())} title="Run in Terminal">
              {'\u{25B6}'} Run
            </button>
          )}
          <button className="code-block-copy" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}

/**
 * Formats a context window size for display (e.g. 8192 -> "8K")
 */
function formatCtx(n: number): string {
  if (n >= 1024) return `${(n / 1024).toFixed(n % 1024 === 0 ? 0 : 1)}K`
  return n.toString()
}

export default function ChatPane({
  messages,
  streamingText,
  isStreaming,
  contextInfo,
  modelName,
  agentEmoji = '\u{1F916}',
  onSendToEditor,
  onRunInTerminal,
}: ChatPaneProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // Smart auto-scroll: pause when user scrolls up, resume when near bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setAutoScroll(distanceFromBottom < 80)
  }, [])

  // Auto-scroll to bottom when new content arrives (only if enabled)
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingText, autoScroll])

  // Render the top info bar
  const topBar = (
    <div className="chat-topbar">
      {modelName && (
        <span className="model-badge" title="Active model">
          {modelName}
        </span>
      )}
      {contextInfo && (
        <span
          className={`ctx-badge ${contextInfo.wasClamped ? 'clamped' : ''}`}
          title={
            contextInfo.wasClamped
              ? `Requested ${formatCtx(contextInfo.requestedCtx)} but clamped to ${formatCtx(contextInfo.effectiveCtx)}. Lower context in Settings to avoid this.`
              : `Context window: ${formatCtx(contextInfo.effectiveCtx)} tokens`
          }
        >
          ctx {formatCtx(contextInfo.effectiveCtx)}
          {contextInfo.wasClamped && (
            <span className="ctx-clamp-indicator"> &#x26A0;</span>
          )}
        </span>
      )}
      {isStreaming && (
        <span className="streaming-badge">Generating...</span>
      )}
    </div>
  )

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="chat-pane">
        {topBar}
        <div className="chat-empty">
          <span className="icon">&#x1F4AC;</span>
          <p>Start a conversation</p>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-pane">
      {topBar}

      <div className="chat-messages" ref={scrollRef} onScroll={handleScroll}>
        {messages.map((msg) => (
          <div key={msg.id} className={`message-row ${msg.role}`}>
            <div className="message-content">
              <div className="message-bubble">
                {renderMarkdown(msg.content, onSendToEditor, onRunInTerminal)}
              </div>
              <div className="message-avatar">
                {msg.role === 'user' ? '\u{1F464}' : agentEmoji}
              </div>
            </div>
          </div>
        ))}

        {isStreaming && streamingText && (
          <div className="message-row assistant">
            <div className="message-content">
              <div className="message-bubble">
                {renderMarkdown(streamingText, onSendToEditor, onRunInTerminal)}
                <span className="streaming-cursor" />
              </div>
              <div className="message-avatar">{agentEmoji}</div>
            </div>
          </div>
        )}

        {isStreaming && !streamingText && (
          <div className="message-row assistant">
            <div className="message-content">
              <div className="message-bubble">
                <span className="streaming-cursor" />
              </div>
              <div className="message-avatar">{agentEmoji}</div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Scroll-to-bottom FAB when user scrolls up during streaming */}
      {!autoScroll && (
        <button
          className="scroll-to-bottom"
          onClick={() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
            setAutoScroll(true)
          }}
          title="Scroll to bottom"
        >
          &#x2193;
        </button>
      )}
    </div>
  )
}
