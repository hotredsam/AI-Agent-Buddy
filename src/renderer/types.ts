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
  listFiles: () => Promise<UserFile[]>
  importFile: () => Promise<UserFile | null>
  deleteFile: (fileName: string) => Promise<boolean>
  openFilesFolder: () => Promise<void>
  generateCheckpoint: () => Promise<string>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
