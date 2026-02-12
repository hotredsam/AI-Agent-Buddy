import React, { useState, useRef, useEffect } from 'react'
import type { Conversation } from '../types'

type View = 'chat' | 'settings' | 'workspace' | 'code'

interface SidebarProps {
  conversations: Conversation[]
  activeConversationId: string | null
  view: View
  collapsed: boolean
  onToggleCollapse: () => void
  onSelectConversation: (id: string) => void
  onNewChat: () => void
  onDeleteConversation: (id: string) => void
  onRenameConversation: (id: string, title: string) => void
  onChangeView: (view: View) => void
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffSec = Math.floor((now - then) / 1000)

  if (diffSec < 60) return 'now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d`
  const diffMonth = Math.floor(diffDay / 30)
  return `${diffMonth}mo`
}

export default function Sidebar({
  conversations,
  activeConversationId,
  view,
  collapsed,
  onToggleCollapse,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onChangeView,
}: SidebarProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [search, setSearch] = useState('')

  const filteredConversations = search.trim()
    ? conversations.filter(c => c.title.toLowerCase().includes(search.toLowerCase()))
    : conversations
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  const startRename = (conv: Conversation) => {
    setRenamingId(conv.id)
    setRenameValue(conv.title)
  }

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRenameConversation(renamingId, renameValue.trim())
    }
    setRenamingId(null)
    setRenameValue('')
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitRename()
    } else if (e.key === 'Escape') {
      setRenamingId(null)
      setRenameValue('')
    }
  }

  // Collapsed sidebar: just icons
  if (collapsed) {
    return (
      <div className="sidebar collapsed">
        <div className="sidebar-header">
          <button
            className="sidebar-hamburger"
            onClick={onToggleCollapse}
            title="Expand sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <rect y="2" width="16" height="1.5" rx="0.75" fill="currentColor" />
              <rect y="7.25" width="16" height="1.5" rx="0.75" fill="currentColor" />
              <rect y="12.5" width="16" height="1.5" rx="0.75" fill="currentColor" />
            </svg>
          </button>
        </div>
        <div className="sidebar-nav">
          <button
            className={`sidebar-nav-btn ${view === 'chat' ? 'active' : ''}`}
            onClick={() => onChangeView('chat')}
            title="Chat"
          >
            {'\u{1F4AC}'}
          </button>
          <button
            className={`sidebar-nav-btn ${view === 'settings' ? 'active' : ''}`}
            onClick={() => onChangeView('settings')}
            title="Settings"
          >
            &#x2699;
          </button>
          <button
            className={`sidebar-nav-btn ${view === 'code' ? 'active' : ''}`}
            onClick={() => onChangeView('code')}
            title="Code"
          >
            {'\u{1F4BB}'}
          </button>
          <button
            className={`sidebar-nav-btn ${view === 'workspace' ? 'active' : ''}`}
            onClick={() => onChangeView('workspace')}
            title="Files"
          >
            &#x1F4C1;
          </button>
        </div>
        <div style={{ flex: 1 }} />
        <div className="sidebar-collapsed-new">
          <button
            className="sidebar-nav-btn"
            onClick={onNewChat}
            title="New Chat"
          >
            +
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-header-top">
          <button
            className="sidebar-hamburger"
            onClick={onToggleCollapse}
            title="Collapse sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <rect y="2" width="16" height="1.5" rx="0.75" fill="currentColor" />
              <rect y="7.25" width="16" height="1.5" rx="0.75" fill="currentColor" />
              <rect y="12.5" width="16" height="1.5" rx="0.75" fill="currentColor" />
            </svg>
          </button>
          <div className="sidebar-brand">AI Agent IDE</div>
        </div>
        <button className="sidebar-new-chat-btn" onClick={onNewChat}>
          <span className="icon">+</span>
          <span>New Chat</span>
        </button>
      </div>

      <div className="sidebar-nav">
        <button
          className={`sidebar-nav-btn ${view === 'chat' ? 'active' : ''}`}
          onClick={() => onChangeView('chat')}
          title="Chat"
        >
          Chat
        </button>
        <button
          className={`sidebar-nav-btn ${view === 'settings' ? 'active' : ''}`}
          onClick={() => onChangeView('settings')}
          title="Settings"
        >
          &#x2699; Settings
        </button>
        <button
          className={`sidebar-nav-btn ${view === 'code' ? 'active' : ''}`}
          onClick={() => onChangeView('code')}
          title="Code Editor"
        >
          {'\u{1F4BB}'} Code
        </button>
        <button
          className={`sidebar-nav-btn ${view === 'workspace' ? 'active' : ''}`}
          onClick={() => onChangeView('workspace')}
          title="Files"
        >
          &#x1F4C1; Files
        </button>
      </div>

      <div className="sidebar-search">
        <input
          className="sidebar-search-input"
          type="text"
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="sidebar-search-clear" onClick={() => setSearch('')}>&#x2715;</button>
        )}
      </div>

      <div className="conversation-list">
        {filteredConversations.map((conv) => (
          <div
            key={conv.id}
            className={`conversation-item ${conv.id === activeConversationId ? 'active' : ''}`}
            onClick={() => {
              onSelectConversation(conv.id)
              if (view !== 'chat') onChangeView('chat')
            }}
            onDoubleClick={() => startRename(conv)}
          >
            {renamingId === conv.id ? (
              <input
                ref={renameInputRef}
                className="rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={handleRenameKeyDown}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="conversation-title">{conv.title}</span>
                <span className="conversation-time">{relativeTime(conv.updatedAt)}</span>
                <div className="conversation-actions">
                  <button
                    className="conv-action-btn"
                    title="Rename"
                    onClick={(e) => {
                      e.stopPropagation()
                      startRename(conv)
                    }}
                  >
                    &#x270E;
                  </button>
                  <button
                    className="conv-action-btn delete"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteConversation(conv.id)
                    }}
                  >
                    &#x2715;
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {filteredConversations.length === 0 && (
          <div style={{ padding: '24px 16px', color: '#556', textAlign: 'center', fontSize: 13 }}>
            No conversations yet
          </div>
        )}
      </div>
    </div>
  )
}
