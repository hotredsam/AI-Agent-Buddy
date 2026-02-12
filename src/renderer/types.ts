// ---- Domain Types ----

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

export type ThemeName = 'glass' | 'forest' | 'ocean' | 'ember' | 'midnight' | 'slate' | 'sand' | 'rose' | 'cyber' | 'classic'

export interface Settings {
  ollamaEndpoint: string
  modelName: string
  numCtx: number
  theme: ThemeName
  apiKeys?: Record<string, string>
  permissions?: {
    allowTerminal: boolean
    allowFileWrite: boolean
    allowAICodeExec: boolean
  }
  activeProvider?: 'ollama' | 'openai' | 'anthropic' | 'google' | 'groq'
}

export interface UserFile {
  name: string
  path: string
  size: number
  modifiedAt: string
  type: string
}

// ---- Electron Bridge ----

export interface ElectronAPI {
  listConversations: () => Promise<Conversation[]>
  createConversation: () => Promise<Conversation>
  deleteConversation: (id: string) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
  listMessages: (conversationId: string) => Promise<Message[]>
  sendMessage: (conversationId: string, text: string, settings?: Partial<Settings>) => Promise<void>
  getSettings: () => Promise<Settings>
  setSettings: (settings: Partial<Settings>) => Promise<void>
  checkHealth: () => Promise<boolean>
  listModels: () => Promise<string[]>
  runDiagnostics: () => Promise<{
    serverReachable: boolean
    availableModels: string[]
    modelFound: boolean
    error: string | null
  }>
  onToken: (callback: (data: { conversationId: string; token: string }) => void) => () => void
  onDone: (callback: (data: { conversationId: string }) => void) => () => void
  onError: (callback: (data: { conversationId: string; error: string }) => void) => () => void
  onContextInfo: (callback: (data: {
    conversationId: string
    requestedCtx: number
    effectiveCtx: number
    wasClamped: boolean
  }) => void) => () => void
  listFiles: () => Promise<UserFile[]>
  importFile: () => Promise<UserFile | null>
  importFileByPath: (filePath: string) => Promise<UserFile | null>
  importFileByBuffer: (fileName: string, buffer: ArrayBuffer) => Promise<UserFile | null>
  deleteFile: (fileName: string) => Promise<boolean>
  openFilesFolder: () => Promise<void>
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>
  terminalExecute: (command: string, cwd: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  terminalGetCwd: () => Promise<string>
  readFile: (filePath: string) => Promise<string | null>
  writeFile: (filePath: string, content: string) => Promise<boolean>
  generateCheckpoint: () => Promise<string>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
