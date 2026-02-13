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
  codingModel?: string
  imageModel?: string
  numCtx: number
  theme: ThemeName
  apiKeys?: Record<string, string>
  permissions?: {
    allowTerminal: boolean
    allowFileWrite: boolean
    allowAICodeExec: boolean
  }
  activeProvider?: 'ollama' | 'openai' | 'anthropic' | 'google' | 'groq'
  codingProvider?: 'ollama' | 'openai' | 'anthropic' | 'google' | 'groq'
  imageProvider?: 'ollama' | 'openai' | 'anthropic' | 'google' | 'groq'
  systemPrompts?: {
    chat: string
    coding: string
    plan: string
    build: string
    bugfix: string
    image: string
  }
}

export interface UserFile {
  name: string
  path: string
  size: number
  modifiedAt: string
  type: string
  isDirectory: boolean
}

export interface UserFileInfo extends UserFile {
  createdAt: string
}

export interface WorkspaceEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedAt: string
}

export interface AgentStep {
  id: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  result?: string
}

export interface AgentTask {
  id: string
  goal: string
  status: 'planning' | 'waiting_approval' | 'approved' | 'running' | 'completed' | 'failed'
  plan: string
  steps: AgentStep[]
  createdAt: string
  currentStepIndex: number
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
  pullModel: (modelName: string) => Promise<boolean>
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
  createFile: (fileName: string, content: string, directory?: string) => Promise<UserFile | null>
  saveFileAs: (sourcePath: string) => Promise<boolean>
  renameFile: (oldName: string, newName: string) => Promise<UserFile | null>
  moveFile: (fileName: string, destinationDir?: string) => Promise<UserFile | null>
  duplicateFile: (sourceName: string, newName?: string) => Promise<UserFile | null>
  getFileInfo: (fileName: string) => Promise<UserFileInfo | null>
  showInExplorer: (filePath: string) => Promise<boolean>
  openExternal: (filePath: string) => Promise<boolean>
  pickWorkspaceFolder: () => Promise<string | null>
  pickWorkspaceFile: () => Promise<string | null>
  listWorkspaceFolder: (folderPath: string) => Promise<WorkspaceEntry[]>
  createWorkspaceFile: (parentPath: string, fileName: string, content?: string) => Promise<boolean>
  createWorkspaceFolder: (parentPath: string, folderName: string) => Promise<boolean>
  renameWorkspacePath: (targetPath: string, nextName: string) => Promise<string | null>
  deleteWorkspacePath: (targetPath: string) => Promise<boolean>
  
  createAgentTask: (goal: string) => Promise<AgentTask>
  listAgentTasks: () => Promise<AgentTask[]>
  getAgentTask: (id: string) => Promise<AgentTask | undefined>
  approveAgentTask: (id: string) => Promise<AgentTask>
  onAgentUpdate: (callback: (tasks: AgentTask[]) => void) => () => void

  getSystemStats: () => Promise<{ freeMem: number; totalMem: number; platform: string; cpus: number }>
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>
  terminalSpawn: (options: { cwd?: string; cols?: number; rows?: number }) => Promise<number>
  terminalWrite: (ptyId: number, data: string) => Promise<void>
  terminalResize: (ptyId: number, cols: number, rows: number) => Promise<void>
  terminalKill: (ptyId: number) => Promise<void>
  onTerminalData: (ptyId: number, callback: (data: string) => void) => () => void
  onTerminalExit: (ptyId: number, callback: (data: { exitCode: number; signal?: number }) => void) => () => void
  terminalExecute: (command: string, cwd: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  terminalGetCwd: () => Promise<string>
  readFile: (filePath: string) => Promise<string | null>
  writeFile: (filePath: string, content: string) => Promise<boolean>
  generateCode: (payload: {
    prompt: string
    context?: string
    provider?: Settings['activeProvider']
    model?: string
    mode?: 'coding' | 'plan' | 'build' | 'bugfix'
  }) => Promise<{ text: string | null; error?: string }>
  generateImage: (payload: {
    prompt: string
    provider?: Settings['activeProvider']
    model?: string
  }) => Promise<{ filePath: string | null; error?: string }>
  generateCheckpoint: () => Promise<string>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
