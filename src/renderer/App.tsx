import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { Conversation, Message, Settings, ThemeName } from './types'
import Titlebar from './components/Titlebar'
import Sidebar from './components/Sidebar'
import ChatPane from './components/ChatPane'
import Composer from './components/Composer'
import SettingsPane from './components/SettingsPane'
import WorkspacePane from './components/WorkspacePane'
import Toast, { type ToastMessage } from './components/Toast'
import { applyTheme, THEMES } from './themes'

type View = 'chat' | 'settings' | 'workspace'

const DEFAULT_SETTINGS: Settings = {
  ollamaEndpoint: 'http://127.0.0.1:11434',
  modelName: 'glm-4.7-flash',
  numCtx: 8192,
  theme: 'glass',
}

let toastIdCounter = 0
function nextToastId(): string {
  return `toast-${++toastIdCounter}`
}

export default function App() {
  // ---- Core state ----
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [view, setView] = useState<View>('chat')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // ---- Streaming state ----
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const streamingConvIdRef = useRef<string | null>(null)

  // ---- Context window state ----
  const [contextInfo, setContextInfo] = useState<{
    requestedCtx: number
    effectiveCtx: number
    wasClamped: boolean
  } | null>(null)

  // ---- Toast state ----
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((text: string, type: 'error' | 'warning' = 'error') => {
    setToasts((prev) => [...prev, { id: nextToastId(), text, type }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // ---- Load initial data ----
  useEffect(() => {
    async function init() {
      try {
        const [convos, sett] = await Promise.all([
          window.electronAPI.listConversations(),
          window.electronAPI.getSettings(),
        ])
        setConversations(convos)
        setSettings(sett)
        applyTheme(sett.theme as any || 'glass')

        // Auto-select most recent conversation, or create one if empty
        if (convos.length > 0) {
          setActiveConversationId(convos[0].id)
        } else {
          // Bootstrap: create initial conversation so user can type immediately
          try {
            const newConv = await window.electronAPI.createConversation()
            setConversations([newConv])
            setActiveConversationId(newConv.id)
          } catch (e) {
            console.error('Failed to bootstrap chat session:', e)
          }
        }

        // Ollama diagnostics on startup
        try {
          const diag = await window.electronAPI.runDiagnostics()
          if (!diag.serverReachable) {
            addToast('Ollama is not running. Start it with: ollama serve', 'warning')
          } else if (!diag.modelFound) {
            addToast(diag.error || 'Model not found. Check Settings.', 'warning')
          }
        } catch {
          addToast('Could not run Ollama diagnostics.', 'warning')
        }
      } catch (err: any) {
        addToast('Failed to initialize: ' + (err?.message || 'Unknown error'))
      }
    }
    init()
  }, [addToast])

  // ---- Load messages when active conversation changes ----
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([])
      return
    }
    window.electronAPI
      .listMessages(activeConversationId)
      .then(setMessages)
      .catch((err) => addToast('Failed to load messages: ' + err.message))
  }, [activeConversationId, addToast])

  // ---- Subscribe to streaming events ----
  useEffect(() => {
    const unsubToken = window.electronAPI.onToken((data) => {
      if (data.conversationId === streamingConvIdRef.current) {
        setStreamingText((prev) => prev + data.token)
      }
    })

    const unsubDone = window.electronAPI.onDone((data) => {
      if (data.conversationId === streamingConvIdRef.current) {
        // Reload messages to get the finalized assistant message from store
        window.electronAPI
          .listMessages(data.conversationId)
          .then(setMessages)
          .catch(() => {})
        setIsStreaming(false)
        setStreamingText('')
        streamingConvIdRef.current = null

        // Refresh conversation list to update timestamps
        window.electronAPI.listConversations().then(setConversations).catch(() => {})
      }
    })

    const unsubError = window.electronAPI.onError((data) => {
      if (data.conversationId === streamingConvIdRef.current) {
        addToast('Streaming error: ' + data.error)
        // Still try to reload messages in case a partial response was saved
        window.electronAPI
          .listMessages(data.conversationId)
          .then(setMessages)
          .catch(() => {})
        setIsStreaming(false)
        setStreamingText('')
        streamingConvIdRef.current = null
      }
    })

    const unsubContextInfo = window.electronAPI.onContextInfo((data) => {
      if (data.conversationId === streamingConvIdRef.current) {
        setContextInfo({
          requestedCtx: data.requestedCtx,
          effectiveCtx: data.effectiveCtx,
          wasClamped: data.wasClamped,
        })
        if (data.wasClamped) {
          addToast(
            `Context window auto-reduced: ${data.requestedCtx.toLocaleString()} → ${data.effectiveCtx.toLocaleString()} tokens (saved to settings).`,
            'warning'
          )
          // Auto-update settings so user doesn't keep hitting this
          setSettings(prev => {
            const updated = { ...prev, numCtx: data.effectiveCtx }
            window.electronAPI.setSettings(updated).catch(() => {})
            return updated
          })
        }
      }
    })

    return () => {
      unsubToken()
      unsubDone()
      unsubError()
      unsubContextInfo()
    }
  }, [addToast])

  // ---- Handlers ----

  const handleNewChat = useCallback(async () => {
    try {
      const conv = await window.electronAPI.createConversation()
      setConversations((prev) => [conv, ...prev])
      setActiveConversationId(conv.id)
      setMessages([])
      setView('chat')
    } catch (err: any) {
      addToast('Failed to create conversation: ' + err.message)
    }
  }, [addToast])

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id)
  }, [])

  const handleDeleteConversation = useCallback(async (id: string) => {
    try {
      await window.electronAPI.deleteConversation(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (activeConversationId === id) {
        setActiveConversationId(null)
        setMessages([])
      }
    } catch (err: any) {
      addToast('Failed to delete conversation: ' + err.message)
    }
  }, [activeConversationId, addToast])

  const handleRenameConversation = useCallback(async (id: string, title: string) => {
    try {
      await window.electronAPI.renameConversation(id, title)
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c))
      )
    } catch (err: any) {
      addToast('Failed to rename conversation: ' + err.message)
    }
  }, [addToast])

  const handleSendMessage = useCallback(async (text: string) => {
    if (!activeConversationId || isStreaming) return

    // Optimistic UI: add user message immediately
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      conversationId: activeConversationId,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempUserMsg])
    setIsStreaming(true)
    setStreamingText('')
    streamingConvIdRef.current = activeConversationId

    try {
      await window.electronAPI.sendMessage(activeConversationId, text)

      // Auto-title if still "New Conversation"
      const conv = conversations.find(c => c.id === activeConversationId)
      if (conv && conv.title === 'New Conversation') {
        const autoTitle = text.length > 40 ? text.slice(0, 40) + '...' : text
        await window.electronAPI.renameConversation(activeConversationId, autoTitle)
        setConversations(prev =>
          prev.map(c => c.id === activeConversationId ? { ...c, title: autoTitle } : c)
        )
      }
    } catch (err: any) {
      addToast('Failed to send message: ' + err.message)
      setIsStreaming(false)
      setStreamingText('')
      streamingConvIdRef.current = null
    }
  }, [activeConversationId, isStreaming, addToast, conversations])

  const handleSaveSettings = useCallback(async (newSettings: Settings) => {
    try {
      await window.electronAPI.setSettings(newSettings)
      setSettings(newSettings)
      applyTheme(newSettings.theme as any || 'glass')
    } catch (err: any) {
      addToast('Failed to save settings: ' + err.message)
    }
  }, [addToast])

  const handleChangeView = useCallback((v: View) => {
    setView(v)
  }, [])

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev)
  }, [])

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N / Cmd+N: New chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        handleNewChat()
      }
      // Ctrl+, / Cmd+,: Settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault()
        setView('settings')
      }
      // Ctrl+1 / Cmd+1: Chat view
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault()
        setView('chat')
      }
      // Ctrl+2 / Cmd+2: Files view
      if ((e.ctrlKey || e.metaKey) && e.key === '2') {
        e.preventDefault()
        setView('workspace')
      }
      // Ctrl+B / Cmd+B: Toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        setSidebarCollapsed(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNewChat])

  // ---- Derived: theme-specific agent emoji ----
  const currentTheme = THEMES[settings.theme as ThemeName] || THEMES.glass
  const agentEmoji = currentTheme.agentEmoji || '\u{1F916}'

  // ---- Render ----
  return (
    <div className="app-root">
      <Titlebar />
      <div className="app-layout">
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        view={view}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onChangeView={handleChangeView}
      />

      <div className="main-content">
        {view === 'chat' && (
          <>
            <ChatPane
              messages={messages}
              streamingText={streamingText}
              isStreaming={isStreaming}
              contextInfo={contextInfo}
              modelName={settings.modelName}
              agentEmoji={agentEmoji}
            />
            <Composer
              onSend={handleSendMessage}
              disabled={isStreaming || !activeConversationId}
            />
          </>
        )}

        {view === 'settings' && (
          <SettingsPane settings={settings} onSave={handleSaveSettings} />
        )}

        {view === 'workspace' && (
          <WorkspacePane />
        )}
      </div>

      <Toast toasts={toasts} onDismiss={dismissToast} />
      </div>
    </div>
  )
}
