import React, { useState } from 'react'
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

  const handleRenameStart = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation()
    setRenamingId(conv.id)
    setRenameValue(conv.title)
  }

  const handleRenameConfirm = (id: string) => {
    if (renameValue.trim()) {
      onRenameConversation(id, renameValue.trim())
    }
    setRenamingId(null)
  }

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
          <button
            className={`sidebar-nav-btn ${view === 'settings' ? 'active' : ''}`}
            onClick={() => onChangeView('settings')}
            title="Settings"
          >
            &#x2699;
          </button>
        </div>
        <div className="sidebar-nav" style={{ marginTop: 'auto', borderBottom: 'none', borderTop: '1px solid var(--border-hairline)' }}>
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
        >
          Chat
        </button>
        <button
          className={`sidebar-nav-btn ${view === 'code' ? 'active' : ''}`}
          onClick={() => onChangeView('code')}
        >
          Code
        </button>
        <button
          className={`sidebar-nav-btn ${view === 'workspace' ? 'active' : ''}`}
          onClick={() => onChangeView('workspace')}
        >
          Files
        </button>
        <button
          className={`sidebar-nav-btn ${view === 'settings' ? 'active' : ''}`}
          onClick={() => onChangeView('settings')}
        >
          Settings
        </button>
      </div>

      {view === 'chat' && (
        <div className="conversation-list">
          <div className="sidebar-brand" style={{ padding: '8px 12px', fontSize: '10px', opacity: 0.5 }}>History</div>
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${conv.id === activeConversationId ? 'active' : ''}`}
              onClick={() => onSelectConversation(conv.id)}
            >
              {renamingId === conv.id ? (
                <input
                  className="rename-input"
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => handleRenameConfirm(conv.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameConfirm(conv.id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
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
                      onClick={(e) => handleRenameStart(e, conv)}
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
        </div>
      )}
    </div>
  )
}
