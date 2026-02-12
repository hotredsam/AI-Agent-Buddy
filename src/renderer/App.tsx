import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { Conversation, Message, Settings, ThemeName, UserFile } from './types'
import Titlebar from './components/Titlebar'
import Sidebar from './components/Sidebar'
import ChatPane from './components/ChatPane'
import Composer from './components/Composer'
import SettingsPane from './components/SettingsPane'
import WorkspacePane from './components/WorkspacePane'
import EditorPane, { type EditorTab } from './components/EditorPane'
import TerminalPane from './components/TerminalPane'
import FileExplorerPane from './components/FileExplorerPane'
import CodeMenuBar from './components/CodeMenuBar'
import Toast, { type ToastMessage } from './components/Toast'
import { applyTheme, THEMES } from './themes'

type View = 'chat' | 'settings' | 'workspace' | 'code'

const DEFAULT_SETTINGS: Settings = {
  ollamaEndpoint: 'http://127.0.0.1:11434',
  modelName: 'glm-4.7-flash',
  codingModel: 'glm-4.7-flash',
  imageModel: 'gpt-image-1',
  numCtx: 8192,
  theme: 'glass',
  permissions: {
    allowTerminal: true,
    allowFileWrite: true,
    allowAICodeExec: false,
  },
  activeProvider: 'ollama',
  codingProvider: 'ollama',
  imageProvider: 'openai',
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
  const [providerConnectionStatus, setProviderConnectionStatus] = useState<'Connected' | 'Offline'>('Connected')
  const [codeAIBusy, setCodeAIBusy] = useState(false)
  const [codeAIStatus, setCodeAIStatus] = useState('')
  const [codingModelOptions, setCodingModelOptions] = useState<string[]>([])

  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
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
    async function init() {
      try {
        const [convos, sett] = await Promise.all([
          window.electronAPI.listConversations(),
          window.electronAPI.getSettings(),
        ])
        setConversations(convos)
        setSettings(sett)
        applyTheme((sett.theme as ThemeName) || 'glass')

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
    if (!activeConversationId) {
      setMessages([])
      return
    }
    window.electronAPI
      .listMessages(activeConversationId)
      .then(setMessages)
      .catch((err) => addToast('Failed to load messages: ' + err.message))
  }, [activeConversationId, addToast])

  useEffect(() => {
    const unsubToken = window.electronAPI.onToken((data) => {
      if (data.conversationId === streamingConvIdRef.current) {
        setStreamingText((prev) => prev + data.token)
      }
    })

    const unsubDone = window.electronAPI.onDone((data) => {
      if (data.conversationId === streamingConvIdRef.current) {
        window.electronAPI.listMessages(data.conversationId).then(setMessages).catch(() => {})
        setIsStreaming(false)
        setStreamingText('')
        streamingConvIdRef.current = null
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
    setView('code')
  }, [])

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

  const handleRunAICode = useCallback(async (
    promptText: string,
    provider: NonNullable<Settings['activeProvider']>,
    model: string,
    mode: 'coding' | 'plan' | 'build' | 'bugfix'
  ) => {
    setCodeAIBusy(true)
    setCodeAIStatus('Sending request...')
    const context = activeTab?.content || ''
    try {
      const timeout = new Promise<{ text: null; error: string }>((resolve) => {
        setTimeout(() => resolve({ text: null, error: 'Request timed out. Try a smaller model or shorter prompt.' }), 90000)
      })
      setCodeAIStatus('Generating response...')
      const result = await Promise.race([
        window.electronAPI.generateCode({
          prompt: promptText,
          context,
          provider,
          model,
          mode,
        }),
        timeout,
      ])
      if (!result.text) {
        addToast(result.error || 'AI code generation failed.')
        setCodeAIStatus(result.error || 'Generation failed')
        return
      }

      const extracted = (() => {
        const match = result.text!.match(/```[\w-]*\n([\s\S]*?)```/)
        return (match ? match[1] : result.text!).trim()
      })()

      if (mode === 'plan') {
        const planTab: EditorTab = {
          id: `plan-${Date.now()}`,
          filePath: null,
          name: 'PLAN.md',
          content: result.text || '',
          language: 'Markdown',
          savedContent: '',
        }
        setEditorTabs((prev) => [...prev, planTab])
        setActiveTabId(planTab.id)
      } else if (activeTabId) {
        setEditorTabs((prev) => prev.map((tab) => (
          tab.id === activeTabId ? { ...tab, content: extracted } : tab
        )))
      } else {
        const tab = createUntitledTab(extracted)
        setEditorTabs((prev) => [...prev, tab])
        setActiveTabId(tab.id)
      }
      setCodeAIStatus('Applied to editor')
      addToast('Applied AI output to editor.', 'success')
    } finally {
      setCodeAIBusy(false)
      setTimeout(() => setCodeAIStatus(''), 2500)
    }
  }, [activeTab, activeTabId, addToast])

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
    setStreamingText('')
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
      streamingConvIdRef.current = null
    }
  }, [activeConversationId, isStreaming, addToast, conversations])

  const handleSaveSettings = useCallback(async (newSettings: Settings) => {
    try {
      await window.electronAPI.setSettings(newSettings)
      setSettings(newSettings)
      applyTheme((newSettings.theme as ThemeName) || 'glass')
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
        setSidebarCollapsed((prev) => !prev)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault()
        handleOpenFile()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        handleOpenFile()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNewChat, handleOpenFile])

  const currentTheme = THEMES[settings.theme as ThemeName] || THEMES.glass
  const agentEmoji = currentTheme.agentEmoji || '\u{1F916}'

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
                providerName={settings.activeProvider || 'ollama'}
                providerStatus={providerConnectionStatus}
                fallbackPolicy={(settings.activeProvider || 'ollama') === 'ollama' ? 'Auto' : 'None'}
                defaultCtx={settings.numCtx}
                agentEmoji={agentEmoji}
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
                }}
                onSaveAsFile={handleSaveCodeBlockAsFile}
                onCodeFileAction={handleCodeFileAction}
              />
              <Composer onSend={handleSendMessage} disabled={isStreaming || !activeConversationId} />
            </>
          )}

          {view === 'settings' && <SettingsPane settings={settings} onSave={handleSaveSettings} />}

          {view === 'workspace' && (
            <WorkspacePane
              onOpenInEditor={handleOpenInEditor}
              onNotify={addToast}
              onDownloaded={addDownload}
            />
          )}

          {view === 'code' && (
            <div className="code-layout">
              <CodeMenuBar
                settings={settings}
                onSaveSettings={handleSaveSettings}
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
                onRunAI={handleRunAICode}
                aiBusy={codeAIBusy}
                aiStatus={codeAIStatus}
                modelOptions={codingModelOptions}
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
                    />
                  </div>
                  {showTerminal && (
                    <div className="workspace-split-bottom">
                      <TerminalPane cwd={workspaceRootPath || undefined} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

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
