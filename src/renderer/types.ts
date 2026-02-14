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

export type ThemeName = 'glass' | 'forest' | 'ocean' | 'ember' | 'midnight' | 'slate' | 'sand' | 'rose' | 'cyber' | 'classic' | 'light' | 'light-ocean' | 'light-rose'

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
  agentSafety?: {
    maxActions: number
    maxFileWrites: number
    maxCommands: number
    maxBytesWritten: number
    maxContractViolations: number
    maxCommandTimeoutMs: number
    commandKillGraceMs: number
    maxViolationRetriesPerStep: number
  }
  activeProvider?: 'ollama' | 'openai' | 'anthropic' | 'google' | 'groq' | 'llamacpp'
  codingProvider?: 'ollama' | 'openai' | 'anthropic' | 'google' | 'groq' | 'llamacpp'
  imageProvider?: 'ollama' | 'openai' | 'anthropic' | 'google' | 'groq' | 'llamacpp'
  llamacppEndpoint?: string
  llamacppModelName?: string
  llamacppBinaryPath?: string
  llamacppModelPath?: string
  systemPrompts?: {
    chat: string
    coding: string
    plan: string
    build: string
    bugfix: string
    image: string
  }
  profilePicture?: string
  darkMode?: boolean
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

export interface TerminalShellOption {
  id: 'powershell' | 'cmd' | 'git-bash' | 'wsl'
  label: string
  available: boolean
}

export type RuntimeRequestKind = 'chat' | 'coding' | 'plan' | 'build' | 'bugfix' | 'image'
export type RuntimeRequestPhase = 'preparing' | 'requesting' | 'streaming' | 'processing'
export type RuntimeRequestOutcome = 'completed' | 'failed' | 'cancelled'

export interface RuntimeActiveRequest {
  id: string
  provider: string
  model: string
  kind: RuntimeRequestKind
  phase: RuntimeRequestPhase
  startedAt: string
  phaseUpdatedAt: string
  elapsedMs: number
}

export interface RuntimeRecentRequest {
  id: string
  provider: string
  model: string
  kind: RuntimeRequestKind
  startedAt: string
  endedAt: string
  durationMs: number
  outcome: RuntimeRequestOutcome
  finalPhase: RuntimeRequestPhase
  error?: string
}

export interface RuntimeDiagnostics {
  snapshotAt: string
  activeModels: string[]
  activeRequestCount: number
  activeRequests: RuntimeActiveRequest[]
  recentRequests: RuntimeRecentRequest[]
  imageModelLoaded: boolean
  lastUnloadAt: string | null
}

export interface AgentStep {
  id: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  result?: string
}

export type AgentMode = 'plan' | 'build' | 'coding' | 'bugfix'
export type AgentPhase = 'idle' | 'thinking' | 'writing' | 'testing' | 'done' | 'error'

export interface AgentLogEntry {
  id: string
  timestamp: string
  level: 'info' | 'error' | 'stdout' | 'stderr'
  message: string
}

export type AgentDiffKind = 'add' | 'remove' | 'context'

export interface AgentDiffLine {
  kind: AgentDiffKind
  text: string
  oldLine?: number
  newLine?: number
}

export interface AgentDiffPreview {
  lines: AgentDiffLine[]
  added: number
  removed: number
  truncated: boolean
  hiddenLineCount: number
}

export interface AgentFileWrite {
  id: string
  timestamp: string
  path: string
  bytesBefore: number
  bytesAfter: number
  bytesChanged: number
  preview: string
  diff?: AgentDiffPreview
}

export interface AgentTestRun {
  id: string
  command: string
  exitCode: number
  success: boolean
  output: string
  startedAt: string
  finishedAt: string
}

export interface AgentTask {
  id: string
  goal: string
  mode: AgentMode
  status: 'planning' | 'waiting_approval' | 'approved' | 'running' | 'testing' | 'completed' | 'failed' | 'cancelled'
  phase: AgentPhase
  plan: string
  steps: AgentStep[]
  logs: AgentLogEntry[]
  fileWrites: AgentFileWrite[]
  testRuns: AgentTestRun[]
  createdAt: string
  currentStepIndex: number
  workspaceRootPath: string | null
  autoRunPipeline: boolean
  cancelRequested: boolean
  lastError?: string
}

export interface AgentTaskCreatePayload {
  goal: string
  mode?: AgentMode
  workspaceRootPath?: string | null
  autoRunPipeline?: boolean
}

export interface AgentEvent {
  taskId: string
  timestamp: string
  type:
    | 'task_created'
    | 'planning_started'
    | 'plan_generated'
    | 'waiting_approval'
    | 'approved'
    | 'build_started'
    | 'step_started'
    | 'step_completed'
    | 'file_written'
    | 'testing_started'
    | 'test_command_start'
    | 'test_output'
    | 'test_command_complete'
    | 'task_completed'
    | 'task_failed'
    | 'task_cancelled'
    | 'contract_violation'
    | 'log'
  message?: string
  data?: Record<string, any>
}

// ---- Electron Bridge ----

export interface ElectronAPI {
  listConversations: () => Promise<Conversation[]>
  createConversation: () => Promise<Conversation>
  deleteConversation: (id: string) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
  listMessages: (conversationId: string) => Promise<Message[]>
  sendMessage: (conversationId: string, text: string, settings?: Partial<Settings>) => Promise<void>
  cancelMessage: (conversationId: string) => Promise<boolean>
  getSettings: () => Promise<Settings>
  setSettings: (settings: Partial<Settings>) => Promise<void>
  getSessionState: () => Promise<{ view: string; sidebarCollapsed: boolean; workspaceRootPath: string | null; showExplorer: boolean; showTerminal: boolean }>
  setSessionState: (state: Partial<{ view: string; sidebarCollapsed: boolean; workspaceRootPath: string | null; showExplorer: boolean; showTerminal: boolean }>) => Promise<void>
  checkHealth: () => Promise<boolean>
  listModels: () => Promise<string[]>
  listImageModels: () => Promise<string[]>
  pullModel: (modelName: string) => Promise<boolean>
  checkLlamaCppHealth: () => Promise<boolean>
  listLlamaCppModels: () => Promise<string[]>
  launchLlamaCpp: () => Promise<boolean>
  pickLlamaCppBinary: () => Promise<string | null>
  pickLlamaCppModel: () => Promise<string | null>
  createWorkspaceFileFromAI: (destFolder: string, fileName: string, content: string) => Promise<boolean>
  importFileToWorkspace: (sourcePath: string, destFolder: string) => Promise<boolean>
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
  createProject: (projectName: string) => Promise<UserFile | null>
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
  
  createAgentTask: (payload: string | AgentTaskCreatePayload) => Promise<AgentTask>
  listAgentTasks: () => Promise<AgentTask[]>
  getAgentTask: (id: string) => Promise<AgentTask | undefined>
  approveAgentTask: (id: string, workspaceRootPath?: string | null) => Promise<AgentTask>
  cancelAgentTask: (id: string) => Promise<AgentTask>
  testCreateAgentTaskFixture: (payload: Partial<AgentTask>) => Promise<AgentTask>
  testClearAgentTasks: () => Promise<boolean>
  onAgentUpdate: (callback: (tasks: AgentTask[]) => void) => () => void
  onAgentEvent: (callback: (event: AgentEvent) => void) => () => void
  onAgentTerminalOutput: (callback: (data: { text: string; stream: string }) => void) => () => void

  getSystemStats: () => Promise<{ freeMem: number; totalMem: number; platform: string; cpus: number }>
  getRuntimeDiagnostics: () => Promise<RuntimeDiagnostics>
  onRuntimeDiagnostics: (callback: (data: RuntimeDiagnostics) => void) => () => void
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<boolean>
  windowRestore: () => Promise<void>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>
  onWindowStateChanged: (callback: (data: { isMaximized: boolean; isFullScreen: boolean; isResizable: boolean }) => void) => () => void
  terminalListShells: () => Promise<TerminalShellOption[]>
  terminalSpawn: (options: { cwd?: string; cols?: number; rows?: number; shellId?: string }) => Promise<number>
  terminalWrite: (ptyId: number, data: string) => Promise<void>
  terminalResize: (ptyId: number, cols: number, rows: number) => Promise<void>
  terminalKill: (ptyId: number) => Promise<void>
  onTerminalData: (ptyId: number, callback: (data: string) => void) => () => void
  onTerminalExit: (ptyId: number, callback: (data: { exitCode: number; signal?: number }) => void) => () => void
  terminalExecute: (command: string, cwd: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  terminalGetCwd: () => Promise<string>
  readFile: (filePath: string) => Promise<string | null>
  readFileForChat: (filePath: string) => Promise<{ content: string; type: 'text' | 'image' | 'binary' }>
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
    provider?: Settings['activeProvider'] | 'llamacpp'
    model?: string
  }) => Promise<{ filePath: string | null; error?: string }>
  generateCheckpoint: () => Promise<string>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
