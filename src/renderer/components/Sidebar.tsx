import React, { useState } from 'react'
import type { Conversation } from '../types'

type View = 'chat' | 'settings' | 'workspace' | 'code' | 'modules'

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
  const [searchQuery, setSearchQuery] = useState('')

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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
          <button
            className={`sidebar-nav-btn ${view === 'code' ? 'active' : ''}`}
            onClick={() => onChangeView('code')}
            title="Code"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </button>
          <button
            className={`sidebar-nav-btn ${view === 'workspace' ? 'active' : ''}`}
            onClick={() => onChangeView('workspace')}
            title="Files"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </button>
          <button
            className={`sidebar-nav-btn ${view === 'modules' ? 'active' : ''}`}
            onClick={() => onChangeView('modules')}
            title="Modules"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
        </div>
        <div className="sidebar-nav" style={{ marginTop: 'auto', borderBottom: 'none', borderTop: '1px solid var(--border-hairline)' }}>
          <button
            className={`sidebar-nav-btn ${view === 'settings' ? 'active' : ''}`}
            onClick={() => onChangeView('settings')}
            title="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <button
            className="sidebar-nav-btn"
            onClick={onNewChat}
            title="New Chat"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
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
          className={`sidebar-nav-btn ${view === 'code' ? 'active' : ''}`}
          onClick={() => onChangeView('code')}
          title="Code Editor"
        >
          Code
        </button>
        <button
          className={`sidebar-nav-btn ${view === 'workspace' ? 'active' : ''}`}
          onClick={() => onChangeView('workspace')}
          title="Files"
        >
          Files
        </button>
        <button
          className={`sidebar-nav-btn ${view === 'modules' ? 'active' : ''}`}
          onClick={() => onChangeView('modules')}
          title="Modules"
        >
          Modules
        </button>
      </div>

      <div className="sidebar-nav sidebar-nav-bottom">
        <button
          className={`sidebar-nav-btn settings-gear ${view === 'settings' ? 'active' : ''}`}
          onClick={() => onChangeView('settings')}
          title="Settings"
        >
          <span style={{ marginRight: 6 }}>&#x2699;</span> Settings
        </button>
      </div>

      {view === 'chat' && (
        <div className="conversation-list">
          <div className="sidebar-search">
            <input
              className="sidebar-search-input"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="sidebar-brand" style={{ padding: '8px 12px', fontSize: '10px', opacity: 0.5 }}>History</div>
          {conversations
            .filter(conv => !searchQuery || conv.title.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((conv) => (
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
