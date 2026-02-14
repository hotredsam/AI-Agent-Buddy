import React, { useState, useRef, useEffect } from 'react'

interface ComposerProps {
  onSend: (text: string) => void
  disabled: boolean
  isStreaming?: boolean
  onCancel?: () => void
}

interface Attachment {
  name: string
  path: string
  content: string
}

const MAX_ATTACHMENTS = 5

const SLASH_COMMANDS = [
  { command: '/image', description: 'Generate an image from a text prompt', example: '/image a sunset over mountains' },
  { command: '/code', description: 'Generate code for a specific task', example: '/code create a fibonacci function in Python' },
  { command: '/explain', description: 'Explain a concept or code snippet', example: '/explain how async/await works' },
  { command: '/fix', description: 'Fix a bug or issue in code', example: '/fix the null pointer exception in login.ts' },
  { command: '/summarize', description: 'Summarize text or a conversation', example: '/summarize the key points discussed' },
] as const

export default function Composer({ onSend, disabled, isStreaming = false, onCancel }: ComposerProps) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [disabled])

  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
    }
  }, [text])

  useEffect(() => {
    if (text === '/') {
      setShowSlashMenu(true)
      setSlashFilter('')
      setSelectedIdx(0)
    } else if (text.startsWith('/') && !text.includes(' ')) {
      setShowSlashMenu(true)
      setSlashFilter(text)
      setSelectedIdx(0)
    } else {
      setShowSlashMenu(false)
    }
  }, [text])

  const filteredCommands = SLASH_COMMANDS.filter(
    cmd => !slashFilter || cmd.command.startsWith(slashFilter)
  )

  const handleAttach = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) return
    try {
      const filePath = await window.electronAPI.pickWorkspaceFile()
      if (!filePath) return
      // Avoid duplicate attachments
      if (attachments.some(a => a.path === filePath)) return
      if (attachments.length >= MAX_ATTACHMENTS) return
      const result = await window.electronAPI.readFileForChat(filePath)
      const name = filePath.split(/[\\/]/).pop() || filePath
      setAttachments(prev => [...prev, { name, path: filePath, content: result.content }])
    } catch (err) {
      console.error('Failed to attach file:', err)
    }
  }

  const removeAttachment = (path: string) => {
    setAttachments(prev => prev.filter(a => a.path !== path))
  }

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return

    let message = ''
    for (const att of attachments) {
      message += `[Attached: ${att.name}]\n\`\`\`\n${att.content}\n\`\`\`\n\n`
    }
    message += trimmed

    onSend(message)
    setText('')
    setAttachments([])
    setShowSlashMenu(false)
  }

  const handleSelectCommand = (command: string) => {
    setText(command + ' ')
    setShowSlashMenu(false)
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx(prev => Math.min(prev + 1, filteredCommands.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx(prev => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault()
        handleSelectCommand(filteredCommands[selectedIdx].command)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowSlashMenu(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="composer">
      {showSlashMenu && filteredCommands.length > 0 && (
        <div className="slash-menu">
          <div className="slash-menu-header">Commands</div>
          {filteredCommands.map((cmd, idx) => (
            <button
              key={cmd.command}
              className={`slash-menu-item ${idx === selectedIdx ? 'selected' : ''}`}
              onClick={() => handleSelectCommand(cmd.command)}
              onMouseEnter={() => setSelectedIdx(idx)}
            >
              <span className="slash-cmd">{cmd.command}</span>
              <span className="slash-desc">{cmd.description}</span>
            </button>
          ))}
        </div>
      )}
      {attachments.length > 0 && (
        <div className="composer-attachments">
          {attachments.map(att => (
            <span key={att.path} className="composer-attachment-chip">
              <span className="composer-attachment-chip-name">{att.name}</span>
              <button
                className="composer-attachment-chip-remove"
                onClick={() => removeAttachment(att.path)}
                title="Remove attachment"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="composer-inner">
        <button
          className="composer-attach-btn"
          onClick={handleAttach}
          disabled={disabled || attachments.length >= MAX_ATTACHMENTS}
          title={attachments.length >= MAX_ATTACHMENTS ? `Max ${MAX_ATTACHMENTS} attachments` : 'Attach file'}
        >
          {'\u{1F4CE}'}
        </button>
        <textarea
          ref={textareaRef}
          className="composer-textarea"
          placeholder="Send a message... (type / for commands)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
        />
        <button
          className="composer-send-btn"
          onClick={isStreaming ? onCancel : handleSend}
          disabled={isStreaming ? false : (disabled || !text.trim())}
          title={isStreaming ? 'Stop' : 'Send'}
        >
          {isStreaming ? '\u25A0' : '\u27A4'}
        </button>
      </div>
    </div>
  )
}
