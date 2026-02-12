import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { Conversation, Message, Settings, ThemeName } from './types'
import Titlebar from './components/Titlebar'
import Sidebar from './components/Sidebar'
import ChatPane from './components/ChatPane'
import Composer from './components/Composer'
import SettingsPane from './components/SettingsPane'
import WorkspacePane from './components/WorkspacePane'
import EditorPane from './components/EditorPane'
import TerminalPane from './components/TerminalPane'
import Toast, { type ToastMessage } from './components/Toast'
import { applyTheme, THEMES } from './themes'

type View = 'chat' | 'settings' | 'workspace' | 'code'

const DEFAULT_SETTINGS: Settings = {
  ollamaEndpoint: 'http://127.0.0.1:11434',
  modelName: 'glm-4.7-flash',
  numCtx: 8192,
  theme: 'glass',
  permissions: {
    allowTerminal: true,
    allowFileWrite: true,
    allowAICodeExec: false,
  },
  activeProvider: 'ollama',
}

let toastIdCounter = 0
function nextToastId(): string {
  return `toast-${++toastIdCounter}`
}

/** Detect language from file extension */
function detectLanguage(filePath: string | null): string {
  if (!filePath) return ''
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
    py: 'Python', rs: 'Rust', go: 'Go', java: 'Java', c: 'C', cpp: 'C++',
    h: 'C', hpp: 'C++', cs: 'C#', rb: 'Ruby', php: 'PHP', swift: 'Swift',
    kt: 'Kotlin', dart: 'Dart', html: 'HTML', css: 'CSS', scss: 'SCSS',
    json: 'JSON', yaml: 'YAML', yml: 'YAML', xml: 'XML', md: 'Markdown',
    sql: 'SQL', sh: 'Shell', bash: 'Bash', ps1: 'PowerShell', bat: 'Batch',
    toml: 'TOML', ini: 'INI', cfg: 'Config', txt: 'Text',
  }
  return map[ext] || ext.toUpperCase()
}

export default function App() {
  // ---- Core state ----
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [view, setView] = useState<View>('chat')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // ---- Editor state ----
  const [editorFilePath, setEditorFilePath] = useState<string | null>(null)
  const [editorContent, setEditorContent] = useState('')
  const [editorLanguage, setEditorLanguage] = useState('')

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
        window.electronAPI
          .listMessages(data.conversationId)
          .then(setMessages)
          .catch(() => {})
        setIsStreaming(false)
        setStreamingText('')
        streamingConvIdRef.current = null

        window.electronAPI.listConversations().then(setConversations).catch(() => {})
      }
    })

    const unsubError = window.electronAPI.onError((data) => {
      if (data.conversationId === streamingConvIdRef.current) {
        addToast('Streaming error: ' + data.error)
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
            `Context window auto-reduced: ${data.requestedCtx.toLocaleString()} \u2192 ${data.effectiveCtx.toLocaleString()} tokens (saved to settings).`,
            'warning'
          )
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

  // ---- Editor handlers ----
  const handleOpenFile = useCallback(async () => {
    // Use Electron dialog to pick a file, then read it
    try {
      const file = await window.electronAPI.importFile()
      if (file) {
        const content = await window.electronAPI.readFile(file.path)
        if (content !== null) {
          setEditorFilePath(file.path)
          setEditorContent(content)
          setEditorLanguage(detectLanguage(file.path))
          setView('code')
        }
      }
    } catch (err: any) {
      addToast('Failed to open file: ' + err.message)
    }
  }, [addToast])

  const handleEditorSave = useCallback(async () => {
    if (!editorFilePath) return
    const perms = settings.permissions || { allowFileWrite: true, allowTerminal: true, allowAICodeExec: false }
    if (!perms.allowFileWrite) {
      addToast('File write is disabled in permissions. Enable it in Settings.', 'warning')
      return
    }
    try {
      const ok = await window.electronAPI.writeFile(editorFilePath, editorContent)
      if (!ok) {
        addToast('Failed to save file.')
      }
    } catch (err: any) {
      addToast('Save error: ' + err.message)
    }
  }, [editorFilePath, editorContent, settings.permissions, addToast])

  // ---- AI-powered code actions (extract code blocks, run commands) ----
  const handleSendMessage = useCallback(async (text: string) => {
    if (!activeConversationId || isStreaming) return

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
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        handleNewChat()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault()
        setView('settings')
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault()
        setView('chat')
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '2') {
        e.preventDefault()
        setView('code')
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '3') {
        e.preventDefault()
        setView('workspace')
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        setSidebarCollapsed(prev => !prev)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault()
        handleOpenFile()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNewChat, handleOpenFile])

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
              onSendToEditor={(code) => {
                setEditorContent(code)
                setView('code')
              }}
              onRunInTerminal={(command) => {
                // Switch to code view so user sees terminal
                setView('code')
              }}
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

        {view === 'code' && (
          <div className="workspace-split">
            <div className="workspace-split-top">
              <EditorPane
                filePath={editorFilePath}
                content={editorContent}
                onContentChange={setEditorContent}
                onSave={handleEditorSave}
                language={editorLanguage}
                onOpenFile={handleOpenFile}
              />
            </div>
            <div className="workspace-split-bottom">
              <TerminalPane />
            </div>
          </div>
        )}
      </div>

      <Toast toasts={toasts} onDismiss={dismissToast} />
      </div>
    </div>
  )
}
