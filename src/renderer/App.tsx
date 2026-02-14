import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { Conversation, Message, Settings, ThemeName, UserFile } from './types'
import Titlebar from './components/Titlebar'
import Sidebar from './components/Sidebar'
import ChatPane from './components/ChatPane'
import Composer from './components/Composer'
import SettingsPane from './components/SettingsPane'
import WorkspacePane from './components/WorkspacePane'
import EditorPane, { type EditorTab, type EditorActions } from './components/EditorPane'
import TerminalPane from './components/TerminalPane'
import FileExplorerPane from './components/FileExplorerPane'
import CodeMenuBar from './components/CodeMenuBar'
import AIPane from './components/AIPane'
import CommandPalette from './components/CommandPalette'
import ErrorBoundary from './components/ErrorBoundary'
import Toast, { type ToastMessage } from './components/Toast'
import { applyTheme, THEMES, BASE_THEME_NAMES } from './themes'
import { shortcutManager, DEFAULT_SHORTCUTS } from './shortcuts'

type View = 'chat' | 'settings' | 'workspace' | 'code' | 'modules'

const DEFAULT_SETTINGS: Settings = {
  ollamaEndpoint: 'http://127.0.0.1:11434',
  modelName: 'glm-4.7-flash',
  codingModel: 'glm-4.7-flash',
  imageModel: '',
  numCtx: 8192,
  theme: 'glass',
  permissions: {
    allowTerminal: true,
    allowFileWrite: true,
    allowAICodeExec: false,
  },
  agentSafety: {
    maxActions: 120,
    maxFileWrites: 80,
    maxCommands: 24,
    maxBytesWritten: 1_000_000,
    maxContractViolations: 12,
    maxCommandTimeoutMs: 120_000,
    commandKillGraceMs: 2_000,
    maxViolationRetriesPerStep: 2,
  },
  activeProvider: 'ollama',
  codingProvider: 'ollama',
  imageProvider: 'ollama',
  llamacppEndpoint: 'http://127.0.0.1:8080',
  llamacppModelName: 'qwen3-coder-30b',
  systemPrompts: {
    chat: 'You are a helpful AI assistant. Provide clear and direct answers.',
    coding: 'You are a senior software engineer. Return practical, correct code with minimal fluff.',
    plan: 'You are a technical planner. Break work into concrete executable steps and call out risks.',
    build: 'You are a coding agent in build mode. Implement requested changes completely and safely.',
    bugfix: 'You are in bugfix mode. Identify the root cause and provide the minimal robust fix.',
    image: 'You generate image prompts optimized for clear, high-quality outputs.',
  },
}

let toastIdCounter = 0
let untitledCounter = 0
let downloadIdCounter = 0

function nextToastId(): string {
  return `toast-${++toastIdCounter}`
}

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

function fileNameFromPath(filePath: string): string {
  const separator = filePath.includes('\\') ? '\\' : '/'
  const parts = filePath.split(separator)
  return parts[parts.length - 1] || filePath
}

function createUntitledTab(content = ''): EditorTab {
  untitledCounter += 1
  return {
    id: `untitled-${untitledCounter}`,
    filePath: null,
    name: `untitled-${untitledCounter}.txt`,
    content,
    language: 'Text',
    savedContent: '',
  }
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [view, setView] = useState<View>('chat')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const [editorTabs, setEditorTabs] = useState<EditorTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [workspaceRootPath, setWorkspaceRootPath] = useState<string | null>(null)
  const [recentWorkspacePaths, setRecentWorkspacePaths] = useState<string[]>([])
  const [recentFiles, setRecentFiles] = useState<string[]>([])
  const [showExplorer, setShowExplorer] = useState(false)
  const [showTerminal, setShowTerminal] = useState(true)
  const [editorActions, setEditorActions] = useState<EditorActions | null>(null)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showShortcutsPanel, setShowShortcutsPanel] = useState(false)
  const [providerConnectionStatus, setProviderConnectionStatus] = useState<'Connected' | 'Offline'>('Connected')
  const [codingModelOptions, setCodingModelOptions] = useState<string[]>([])

  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [chatRequestState, setChatRequestState] = useState<'idle' | 'thinking' | 'writing' | 'done' | 'error'>('idle')
  const streamingConvIdRef = useRef<string | null>(null)

  const [contextInfo, setContextInfo] = useState<{
    requestedCtx: number
    effectiveCtx: number
    wasClamped: boolean
  } | null>(null)

  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [downloads, setDownloads] = useState<Array<{ id: string; name: string; path: string }>>([])

  const addToast = useCallback((
    text: string,
    type: 'error' | 'warning' | 'success' = 'error'
  ) => {
    setToasts((prev) => [...prev, { id: nextToastId(), text, type }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addDownload = useCallback((name: string, path: string) => {
    downloadIdCounter += 1
    const item = { id: `download-${downloadIdCounter}`, name, path }
    setDownloads((prev) => [item, ...prev].slice(0, 5))
  }, [])

  const activeTab = useMemo(
    () => editorTabs.find((tab) => tab.id === activeTabId) || null,
    [editorTabs, activeTabId]
  )

  const openOrUpdateFileTab = useCallback((filePath: string, content: string) => {
    const tabId = filePath
    const language = detectLanguage(filePath)
    const name = fileNameFromPath(filePath)

    setRecentFiles((prev) => [filePath, ...prev.filter((p) => p !== filePath)].slice(0, 10))

    setEditorTabs((prev) => {
      const existing = prev.find((tab) => tab.id === tabId)
      if (existing) {
        return prev.map((tab) => (
          tab.id === tabId
            ? { ...tab, filePath, name, language, content, savedContent: content }
            : tab
        ))
      }
      return [...prev, { id: tabId, filePath, name, language, content, savedContent: content }]
    })
    setActiveTabId(tabId)
  }, [])

  useEffect(() => {
    if (!window.electronAPI) return

    async function init() {
      try {
        const [convos, sett] = await Promise.all([
          window.electronAPI.listConversations(),
          window.electronAPI.getSettings(),
        ])
        setConversations(convos)
        setSettings(sett)
        applyTheme((sett.theme as ThemeName) || 'glass', sett.darkMode !== false)

        // Restore session state
        try {
          const session = await window.electronAPI.getSessionState()
          if (session.view) setView(session.view as View)
          if (session.sidebarCollapsed) setSidebarCollapsed(session.sidebarCollapsed)
          if (session.workspaceRootPath) {
            setWorkspaceRootPath(session.workspaceRootPath)
            setShowExplorer(true)
          }
          if (session.showTerminal !== undefined) setShowTerminal(session.showTerminal)
        } catch { /* ignore session restore errors */ }

        if (convos.length > 0) {
          setActiveConversationId(convos[0].id)
        } else {
          const newConv = await window.electronAPI.createConversation()
          setConversations([newConv])
          setActiveConversationId(newConv.id)
        }

        const diag = await window.electronAPI.runDiagnostics()
        if (!diag.serverReachable) {
          setProviderConnectionStatus('Offline')
          addToast('Ollama is not running. Start it with: ollama serve', 'warning')
        } else if (!diag.modelFound && (sett.activeProvider || 'ollama') === 'ollama') {
          addToast(diag.error || 'Model not found. Check Settings.', 'warning')
          setProviderConnectionStatus('Connected')
        } else {
          setProviderConnectionStatus('Connected')
        }

        const localModels = await window.electronAPI.listModels()
        setCodingModelOptions(localModels)
      } catch (err: any) {
        addToast('Failed to initialize: ' + (err?.message || 'Unknown error'))
      }
    }
    init()
  }, [addToast])

  useEffect(() => {
    if (!window.electronAPI?.setSessionState) return
    window.electronAPI.setSessionState({
      view,
      sidebarCollapsed,
      workspaceRootPath,
      showExplorer,
      showTerminal,
    }).catch(() => {})
  }, [view, sidebarCollapsed, workspaceRootPath, showExplorer, showTerminal])

  useEffect(() => {
    if (!window.electronAPI || !activeConversationId) {
      setMessages([])
      return
    }
    window.electronAPI
      .listMessages(activeConversationId)
      .then(setMessages)
      .catch((err) => addToast('Failed to load messages: ' + err.message))
  }, [activeConversationId, addToast])

  useEffect(() => {
    if (!window.electronAPI) return

    const unsubToken = window.electronAPI.onToken((data) => {
      if (data.conversationId === streamingConvIdRef.current) {
        setChatRequestState('writing')
        setStreamingText((prev) => prev + data.token)
      }
    })

    const unsubDone = window.electronAPI.onDone((data) => {
      if (data.conversationId === streamingConvIdRef.current) {
        window.electronAPI.listMessages(data.conversationId).then(setMessages).catch(() => {})
        setIsStreaming(false)
        setStreamingText('')
        streamingConvIdRef.current = null
        setChatRequestState('done')
        setTimeout(() => setChatRequestState('idle'), 1500)
        window.electronAPI.listConversations().then(setConversations).catch(() => {})
      }
    })

    const unsubError = window.electronAPI.onError((data) => {
      if (data.conversationId === streamingConvIdRef.current) {
        addToast('Streaming error: ' + data.error)
        window.electronAPI.listMessages(data.conversationId).then(setMessages).catch(() => {})
        setIsStreaming(false)
        setStreamingText('')
        streamingConvIdRef.current = null
        setChatRequestState('error')
        setTimeout(() => setChatRequestState('idle'), 2200)
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
            `Context auto-reduced: ${data.requestedCtx.toLocaleString()} -> ${data.effectiveCtx.toLocaleString()} tokens.`,
            'warning'
          )
          setSettings((prev) => {
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
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)))
    } catch (err: any) {
      addToast('Failed to rename conversation: ' + err.message)
    }
  }, [addToast])

  const handleOpenFile = useCallback(async () => {
    try {
      const filePath = await window.electronAPI.pickWorkspaceFile()
      if (!filePath) return
      const content = await window.electronAPI.readFile(filePath)
      if (content === null) {
        addToast('Failed to read selected file.')
        return
      }
      openOrUpdateFileTab(filePath, content)
      setView('code')
    } catch (err: any) {
      addToast('Failed to open file: ' + err.message)
    }
  }, [addToast, openOrUpdateFileTab])

  const handleOpenInEditor = useCallback(async (file: UserFile) => {
    const content = await window.electronAPI.readFile(file.path)
    if (content === null) {
      addToast(`Failed to open "${file.name}".`)
      return
    }
    openOrUpdateFileTab(file.path, content)
    setView('code')
  }, [addToast, openOrUpdateFileTab])

  const handleOpenPathInEditor = useCallback(async (filePath: string) => {
    const content = await window.electronAPI.readFile(filePath)
    if (content === null) {
      addToast(`Failed to open "${filePath}".`)
      return
    }
    openOrUpdateFileTab(filePath, content)
    setView('code')
  }, [addToast, openOrUpdateFileTab])

  const handleOpenFolder = useCallback(async () => {
    const picked = await window.electronAPI.pickWorkspaceFolder()
    if (!picked) return
    setWorkspaceRootPath(picked)
    setShowExplorer(true)
    setRecentWorkspacePaths((prev) => [picked, ...prev.filter((p) => p !== picked)].slice(0, 10))
    addToast(`Workspace opened: ${picked}`, 'success')
    setView('code')
  }, [addToast])

  const handleOpenProject = useCallback((projectPath: string) => {
    setWorkspaceRootPath(projectPath)
    setShowExplorer(true)
    setEditorTabs([])
    setActiveTabId(null)
    setRecentWorkspacePaths((prev) => [projectPath, ...prev.filter((p) => p !== projectPath)].slice(0, 10))
    addToast(`Workspace opened: ${projectPath}`, 'success')
    setView('code')
  }, [addToast])

  const handleEditorContentChange = useCallback((content: string) => {
    if (!activeTabId) return
    setEditorTabs((prev) => prev.map((tab) => (tab.id === activeTabId ? { ...tab, content } : tab)))
  }, [activeTabId])

  const handleEditorSave = useCallback(async () => {
    if (!activeTab || !activeTab.filePath) {
      addToast('Only opened files can be saved to disk. Use chat Save for snippets.', 'warning')
      return
    }

    const perms = settings.permissions || { allowFileWrite: true, allowTerminal: true, allowAICodeExec: false }
    if (!perms.allowFileWrite) {
      addToast('File write is disabled in permissions. Enable it in Settings.', 'warning')
      return
    }

    try {
      const ok = await window.electronAPI.writeFile(activeTab.filePath, activeTab.content)
      if (!ok) {
        addToast('Failed to save file.')
        return
      }
      setEditorTabs((prev) => prev.map((tab) => (
        tab.id === activeTab.id ? { ...tab, savedContent: tab.content } : tab
      )))
      addToast(`Saved ${activeTab.name}`, 'success')
    } catch (err: any) {
      addToast('Save error: ' + err.message)
    }
  }, [activeTab, settings.permissions, addToast])

  const handleSelectTab = useCallback((tabId: string) => {
    setActiveTabId(tabId)
  }, [])

  const handleCloseTab = useCallback((tabId: string) => {
    let nextActiveId: string | null = activeTabId
    setEditorTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId)
      if (idx === -1) return prev
      const next = prev.filter((t) => t.id !== tabId)
      if (tabId === activeTabId) {
        const fallback = next[idx] || next[idx - 1] || null
        nextActiveId = fallback?.id || null
      }
      return next
    })
    setActiveTabId(nextActiveId)
  }, [activeTabId])

  const handleNewFile = useCallback(() => {
    const tab = createUntitledTab('')
    setEditorTabs((prev) => [...prev, tab])
    setActiveTabId(tab.id)
    setView('code')
  }, [])

  const handleOpenRecentFolder = useCallback(() => {
    if (recentWorkspacePaths.length === 0) {
      addToast('No recent folders yet.', 'warning')
      return
    }
    const defaultPath = recentWorkspacePaths[0]
    const selected = prompt(
      'Open recent folder (paste or edit path):',
      defaultPath
    )?.trim()
    if (!selected) return
    setWorkspaceRootPath(selected)
    setShowExplorer(true)
    setRecentWorkspacePaths((prev) => [selected, ...prev.filter((p) => p !== selected)].slice(0, 10))
    setView('code')
  }, [recentWorkspacePaths, addToast])

  const handleApplyAIToEditor = useCallback((content: string) => {
    if (activeTabId) {
      setEditorTabs((prev) => prev.map((tab) => (
        tab.id === activeTabId ? { ...tab, content } : tab
      )))
    } else {
      const tab = createUntitledTab(content)
      setEditorTabs((prev) => [...prev, tab])
      setActiveTabId(tab.id)
    }
  }, [activeTabId])

  const handleRenameTab = useCallback(async (tabId: string, newName: string) => {
    const tab = editorTabs.find((t) => t.id === tabId)
    if (!tab) return
    const trimmed = newName.trim()
    if (!trimmed) return

    if (tab.filePath) {
      const renamedPath = await window.electronAPI.renameWorkspacePath(tab.filePath, trimmed)
      if (!renamedPath) {
        addToast('Rename failed.')
        return
      }
      setEditorTabs((prev) => prev.map((t) => (
        t.id === tabId
          ? { ...t, id: renamedPath, filePath: renamedPath, name: trimmed, language: detectLanguage(renamedPath) }
          : t
      )))
      setActiveTabId((prev) => (prev === tabId ? renamedPath : prev))
      if (workspaceRootPath) {
        // trigger explorer refresh by re-setting same path
        setWorkspaceRootPath(workspaceRootPath)
      }
    } else {
      setEditorTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, name: trimmed } : t)))
    }
  }, [editorTabs, addToast, workspaceRootPath])

  const handleSaveCodeBlockAsFile = useCallback(async (code: string, language: string) => {
    const extByLang: Record<string, string> = {
      typescript: 'ts', javascript: 'js', python: 'py', rust: 'rs', go: 'go',
      java: 'java', c: 'c', cpp: 'cpp', csharp: 'cs', ruby: 'rb', php: 'php',
      swift: 'swift', html: 'html', css: 'css', scss: 'scss', json: 'json',
      yaml: 'yml', xml: 'xml', markdown: 'md', sql: 'sql', shell: 'sh',
      bash: 'sh', powershell: 'ps1',
    }
    const ext = extByLang[(language || '').toLowerCase()] || 'txt'
    const defaultName = `snippet-${Date.now()}.${ext}`
    const fileName = prompt('Save code as file name:', defaultName)?.trim()
    if (!fileName) return

    const created = await window.electronAPI.createFile(fileName, code)
    if (created) {
      addToast(`Saved "${fileName}" to Library.`, 'success')
      addDownload(fileName, created.path)
    } else {
      addToast('Failed to save file.')
    }
  }, [addToast, addDownload])

  const handleCodeFileAction = useCallback(async (
    action: 'add' | 'download' | 'open' | 'run',
    code: string,
    language: string
  ) => {
    const extByLang: Record<string, string> = {
      typescript: 'ts', javascript: 'js', python: 'py', rust: 'rs', go: 'go',
      java: 'java', c: 'c', cpp: 'cpp', csharp: 'cs', ruby: 'rb', php: 'php',
      swift: 'swift', html: 'html', css: 'css', scss: 'scss', json: 'json',
      yaml: 'yml', xml: 'xml', markdown: 'md', sql: 'sql', shell: 'sh',
      bash: 'sh', powershell: 'ps1',
    }
    const ext = extByLang[(language || '').toLowerCase()] || 'txt'
    const fileName = `generated-${Date.now()}.${ext}`
    const created = await window.electronAPI.createFile(fileName, code)
    if (!created) {
      addToast('Failed to create file from code block.')
      return
    }
    addDownload(created.name, created.path)

    if (action === 'download') {
      const ok = await window.electronAPI.saveFileAs(created.path)
      if (!ok) addToast('Download cancelled.', 'warning')
      return
    }
    if (action === 'open') {
      openOrUpdateFileTab(created.path, code)
      setView('code')
      return
    }
    if (action === 'run') {
      openOrUpdateFileTab(created.path, code)
      setView('code')
      setShowTerminal(true)
      return
    }
    addToast(`Added "${created.name}" to Files.`, 'success')
  }, [addToast, addDownload, openOrUpdateFileTab])

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
    const isImageRequest = text.trim().toLowerCase().startsWith('/image')
    setStreamingText(isImageRequest ? 'Generating image...' : '')
    setChatRequestState(isImageRequest ? 'writing' : 'thinking')
    streamingConvIdRef.current = activeConversationId

    try {
      await window.electronAPI.sendMessage(activeConversationId, text)

      const conv = conversations.find((c) => c.id === activeConversationId)
      if (conv && conv.title === 'New Conversation') {
        const autoTitle = text.length > 40 ? text.slice(0, 40) + '...' : text
        await window.electronAPI.renameConversation(activeConversationId, autoTitle)
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConversationId ? { ...c, title: autoTitle } : c))
        )
      }
    } catch (err: any) {
      addToast('Failed to send message: ' + err.message)
      setIsStreaming(false)
      setStreamingText('')
      setChatRequestState('error')
      setTimeout(() => setChatRequestState('idle'), 2200)
      streamingConvIdRef.current = null
    }
  }, [activeConversationId, isStreaming, addToast, conversations])

  const handleCancelMessage = useCallback(async () => {
    const activeStreamingConversation = streamingConvIdRef.current
    if (!activeStreamingConversation) return
    try {
      await window.electronAPI.cancelMessage(activeStreamingConversation)
    } catch {
      // Ignore cancel errors and still reset local stream state.
    }
    setIsStreaming(false)
    setStreamingText('')
    setChatRequestState('idle')
    streamingConvIdRef.current = null
    addToast('Request cancelled.', 'warning')
  }, [addToast])

  const handleSaveSettings = useCallback(async (newSettings: Settings) => {
    try {
      await window.electronAPI.setSettings(newSettings)
      setSettings(newSettings)
      applyTheme((newSettings.theme as ThemeName) || 'glass', newSettings.darkMode !== false)
    } catch (err: any) {
      addToast('Failed to save settings: ' + err.message)
    }
  }, [addToast])

  const handleChangeView = useCallback((v: View) => {
    setView(v)
  }, [])

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev)
  }, [])

  // ── Centralized keyboard shortcut manager ──
  useEffect(() => {
    const mgr = shortcutManager

    // Cycle through available themes
    const cycleTheme = () => {
      setSettings((prev) => {
        const idx = BASE_THEME_NAMES.indexOf(prev.theme as ThemeName)
        const next = BASE_THEME_NAMES[(idx + 1) % BASE_THEME_NAMES.length]
        const updated = { ...prev, theme: next }
        applyTheme(next, prev.darkMode !== false)
        window.electronAPI?.setSettings(updated).catch(() => {})
        return updated
      })
    }

    // Register all default shortcuts with their handlers
    mgr.register('Ctrl+B', 'toggle-sidebar', () => setSidebarCollapsed((p) => !p), 'Toggle Sidebar')
    mgr.register('Ctrl+N', 'new-conversation', () => handleNewChat(), 'New Conversation')
    mgr.register('Ctrl+Shift+T', 'toggle-theme', cycleTheme, 'Cycle Theme')
    mgr.register('Ctrl+Shift+P', 'command-palette', () => setShowShortcutsPanel((p) => !p), 'Command Palette')
    mgr.register('Ctrl+L', 'focus-chat', () => {
      setView('chat')
      // After switching to chat view, focus the composer textarea
      setTimeout(() => {
        const textarea = document.querySelector<HTMLTextAreaElement>('.composer-textarea, .composer textarea')
        textarea?.focus()
      }, 50)
    }, 'Focus Chat Input')
    mgr.register('Ctrl+`', 'toggle-terminal', () => setShowTerminal((p) => !p), 'Toggle Terminal')
    mgr.register('Ctrl+E', 'toggle-explorer', () => setShowExplorer((p) => !p), 'Toggle File Explorer')
    mgr.register('Ctrl+1', 'switch-to-chat', () => setView('chat'), 'Switch to Chat View')
    mgr.register('Ctrl+2', 'switch-to-code', () => setView('code'), 'Switch to Code View')
    mgr.register('Ctrl+3', 'switch-to-agents', () => setView('workspace'), 'Switch to Agents View')

    // Keep the previous Ctrl+, for settings and Ctrl+O for open file
    mgr.register('Ctrl+,', 'open-settings', () => setView('settings'), 'Open Settings')
    mgr.register('Ctrl+O', 'open-file', () => handleOpenFile(), 'Open File')
    mgr.register('Ctrl+P', 'quick-open', () => setShowCommandPalette((p) => !p), 'Quick Open')

    // New shortcuts (Phase 6.2)
    mgr.register('Ctrl+W', 'close-tab', () => {
      setEditorTabs((prev) => {
        if (prev.length === 0) return prev
        setActiveTabId((curId) => {
          const idx = prev.findIndex((t) => t.id === curId)
          const next = prev.filter((t) => t.id !== curId)
          const fallback = next[idx] || next[idx - 1] || null
          return fallback?.id || null
        })
        return prev.filter((t) => t.id !== activeTabId)
      })
    }, 'Close Current Tab')

    mgr.register('Ctrl+Shift+N', 'new-project', async () => {
      const name = prompt('New project name:')
      if (!name?.trim()) return
      try {
        const result = await window.electronAPI.createProject(name.trim())
        if (result?.path) {
          setWorkspaceRootPath(result.path)
          setShowExplorer(true)
          setView('code')
        }
      } catch { /* ignore */ }
    }, 'New Project')

    mgr.register('Ctrl+Shift+E', 'focus-explorer', () => {
      setShowExplorer(true)
      setView('code')
    }, 'Focus Explorer')

    mgr.register('Ctrl+Shift+B', 'toggle-ai-pane', () => {
      // Toggle the AI pane collapsed state via DOM class
      const aiPane = document.querySelector('.ai-pane')
      if (aiPane) aiPane.classList.toggle('collapsed')
    }, 'Toggle AI Pane')

    mgr.register('Ctrl+K', 'clear-chat', () => {
      setMessages([])
    }, 'Clear Chat')

    mgr.register('F5', 'refresh-connection', async () => {
      try {
        const diag = await window.electronAPI.runDiagnostics()
        setProviderConnectionStatus(diag.serverReachable ? 'Connected' : 'Offline')
        const localModels = await window.electronAPI.listModels()
        setCodingModelOptions(localModels)
      } catch { /* ignore */ }
    }, 'Refresh Connection')

    mgr.register('Ctrl+Shift+D', 'run-diagnostics', async () => {
      try {
        const diag = await window.electronAPI.runDiagnostics()
        const stats = await window.electronAPI.getSystemStats()
        alert(
          `Diagnostics:\n\nServer: ${diag.serverReachable ? 'Connected' : 'Offline'}` +
          `\nModels: ${diag.models?.join(', ') || 'None found'}` +
          `\nRAM: ${stats?.usedMemMB ?? '?'}MB / ${stats?.totalMemMB ?? '?'}MB` +
          `\nCPUs: ${stats?.cpuCount ?? '?'}`
        )
      } catch { /* ignore */ }
    }, 'Run Diagnostics')

    mgr.start()

    return () => {
      mgr.destroy()
    }
  }, [handleNewChat, handleOpenFile, activeTabId])

  const currentTheme = THEMES[settings.theme as ThemeName] || THEMES.glass
  const agentEmoji = currentTheme.agentEmoji || '\u{1F916}'

  if (!window.electronAPI) {
    return (
      <div className="app-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', textAlign: 'center', padding: 40 }}>
        <div>
          <h1 style={{ marginBottom: 16 }}>Failed to load Electron API</h1>
          <p style={{ opacity: 0.7, maxWidth: 500, lineHeight: 1.6 }}>
            The app's bridge between the renderer and system process is missing. 
            This usually means the preload script failed to load or the app is running in an unsupported environment.
          </p>
          <div style={{ marginTop: 24, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 8, fontFamily: 'monospace', fontSize: 12 }}>
            Diagnostic Info: {window.location.protocol} | {window.location.host}
          </div>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: 24, padding: '10px 20px', background: '#6eaaff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
          >
            Reload App
          </button>
        </div>
      </div>
    )
  }

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
            <ErrorBoundary>
              <ChatPane
                messages={messages}
                streamingText={streamingText}
                isStreaming={isStreaming}
                requestState={chatRequestState}
                contextInfo={contextInfo}
                modelName={(settings.activeProvider === 'llamacpp') ? (settings.llamacppModelName || settings.modelName) : settings.modelName}
                providerName={settings.activeProvider || 'ollama'}
                providerStatus={providerConnectionStatus}
                fallbackPolicy={(settings.activeProvider || 'ollama') === 'ollama' ? 'Auto' : 'None'}
                defaultCtx={settings.numCtx}
                agentEmoji={agentEmoji}
                profilePicture={settings.profilePicture}
                onSendToEditor={(code) => {
                  if (activeTabId) {
                    setEditorTabs((prev) => prev.map((tab) => (
                      tab.id === activeTabId ? { ...tab, content: code } : tab
                    )))
                  } else {
                    const tab = createUntitledTab(code)
                    setEditorTabs((prev) => [...prev, tab])
                    setActiveTabId(tab.id)
                  }
                  setView('code')
                }}
                onRunInTerminal={() => {
                  setView('code')
                  setShowTerminal(true)
                }}
                onSaveAsFile={handleSaveCodeBlockAsFile}
                onCodeFileAction={handleCodeFileAction}
              />
              <Composer
                onSend={handleSendMessage}
                disabled={isStreaming || !activeConversationId}
                isStreaming={isStreaming}
                onCancel={handleCancelMessage}
              />
            </ErrorBoundary>
          )}

          {view === 'settings' && <ErrorBoundary><SettingsPane settings={settings} onSave={handleSaveSettings} /></ErrorBoundary>}

          {view === 'workspace' && (
            <ErrorBoundary>
              <WorkspacePane
                onOpenInEditor={handleOpenInEditor}
                onOpenProject={handleOpenProject}
                onNotify={addToast}
                onDownloaded={addDownload}
              />
            </ErrorBoundary>
          )}

          {view === 'modules' && (
            <ErrorBoundary>
            <div className="modules-pane">
              <div className="modules-content">
                <svg className="modules-icon-svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
                <h2>App Store</h2>
                <p className="modules-subtitle">Install apps that extend your AI Agent IDE</p>
                <p className="modules-desc">Apps connect to the IDE through our <strong>Sockets</strong> system, giving them access to AI capabilities, file management, and terminal access.</p>

                <div className="modules-app-grid">
                  <div className="module-app-card">
                    <div className="module-app-icon">{'\u{1F4DA}'}</div>
                    <h3>CPA Study Assistant</h3>
                    <p>Study for CPA exams with AI-powered quizzes and practice problems</p>
                    <span className="modules-badge">Coming Soon</span>
                  </div>
                  <div className="module-app-card">
                    <div className="module-app-icon">{'\u{1F4CA}'}</div>
                    <h3>Excel Data Visualizer</h3>
                    <p>Analyze and visualize spreadsheet data with AI-generated charts</p>
                    <span className="modules-badge">Coming Soon</span>
                  </div>
                  <div className="module-app-card">
                    <div className="module-app-icon">{'\u{1F4B0}'}</div>
                    <h3>Budget Analyzer</h3>
                    <p>Monthly budget analysis, insights, and financial planning with AI</p>
                    <span className="modules-badge">Coming Soon</span>
                  </div>
                </div>

                <div className="modules-sockets-note">
                  <strong>Sockets API</strong> is currently in development. Build your own apps that integrate with the IDE's AI, file system, and terminal.
                </div>
              </div>
            </div>
            </ErrorBoundary>
          )}

          {view === 'code' && (
            <ErrorBoundary>
            <div className="code-layout">
              <CodeMenuBar
                showExplorer={showExplorer}
                showTerminal={showTerminal}
                onToggleExplorer={() => setShowExplorer((prev) => !prev)}
                onToggleTerminal={() => setShowTerminal((prev) => !prev)}
                onNewFile={handleNewFile}
                onOpenFile={handleOpenFile}
                onOpenFolder={handleOpenFolder}
                onOpenRecent={handleOpenRecentFolder}
                onSaveFile={handleEditorSave}
                onCloseTab={() => activeTabId ? handleCloseTab(activeTabId) : undefined}
              />
              <div className="code-main-area">
                {showExplorer && (
                  <FileExplorerPane
                    rootPath={workspaceRootPath}
                    onRootPathChange={setWorkspaceRootPath}
                    activeFilePath={activeTab?.filePath || null}
                    onOpenFile={handleOpenPathInEditor}
                    onNotify={addToast}
                  />
                )}
                <div className="workspace-split">
                  <div className="workspace-split-top">
                    <EditorPane
                      tabs={editorTabs}
                      activeTabId={activeTabId}
                      onSelectTab={handleSelectTab}
                      onCloseTab={handleCloseTab}
                      onRenameTab={handleRenameTab}
                      onContentChange={handleEditorContentChange}
                      onSave={handleEditorSave}
                      onNewFile={handleNewFile}
                      onOpenFile={handleOpenFile}
                      onOpenFolder={handleOpenFolder}
                      onOpenRecent={handleOpenRecentFolder}
                      recentFiles={recentFiles}
                      onOpenRecentFile={handleOpenPathInEditor}
                      onEditorReady={setEditorActions}
                    />
                  </div>
                  {showTerminal && (
                    <div className="workspace-split-bottom">
                      <TerminalPane cwd={workspaceRootPath || undefined} />
                    </div>
                  )}
                </div>
                <AIPane
                  settings={settings}
                  modelOptions={codingModelOptions}
                  workspaceRootPath={workspaceRootPath}
                  onWorkspaceRootPathChange={setWorkspaceRootPath}
                  activeFileContent={activeTab?.content || ''}
                  openTabs={editorTabs.map((t) => ({ id: t.id, name: t.name, content: t.content, filePath: t.filePath }))}
                  onSaveSettings={handleSaveSettings}
                  onApplyToEditor={handleApplyAIToEditor}
                  onInsertAtCursor={editorActions?.insertAtCursor || null}
                  onNotify={addToast}
                />
              </div>
            </div>
            </ErrorBoundary>
          )}
        </div>

        <CommandPalette
          visible={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          onSelectFile={(filePath) => {
            handleOpenPathInEditor(filePath)
            setShowCommandPalette(false)
          }}
          workspaceRootPath={workspaceRootPath}
        />

        {showShortcutsPanel && (
          <div className="shortcuts-panel-overlay" onClick={() => setShowShortcutsPanel(false)}>
            <div className="shortcuts-panel" onClick={(e) => e.stopPropagation()}>
              <div className="shortcuts-panel-header">
                <h2>Keyboard Shortcuts</h2>
                <button className="shortcuts-panel-close" onClick={() => setShowShortcutsPanel(false)}>
                  &#x2715;
                </button>
              </div>
              <div className="shortcuts-panel-list">
                {shortcutManager.getAll().map((s) => (
                  <div key={s.id} className="shortcuts-panel-row">
                    <span className="shortcuts-panel-label">{s.label}</span>
                    <kbd className="shortcuts-panel-keys">{s.keys}</kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <Toast toasts={toasts} onDismiss={dismissToast} />
        {downloads.length > 0 && (
          <div className="download-shelf">
            {downloads.map((d) => (
              <div key={d.id} className="download-item">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong className="download-name">{d.name}</strong>
                  <div className="download-sub">Ready for download/use</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="download-open-btn" onClick={() => window.electronAPI.showInExplorer(d.path)}>
                    Show
                  </button>
                  <button className="download-close-btn" onClick={() => setDownloads(prev => prev.filter(item => item.id !== d.id))}>
                    &#x2715;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
