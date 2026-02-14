import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { randomUUID as uuidv4 } from 'crypto'

// --- Type Definitions ---

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

export interface Settings {
  ollamaEndpoint: string
  modelName: string
  codingModel?: string
  imageModel?: string
  numCtx: number
  theme: string
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

// --- Default Settings ---

const DEFAULT_PERMISSIONS: NonNullable<Settings['permissions']> = {
  allowTerminal: true,
  allowFileWrite: true,
  allowAICodeExec: false,
}

const DEFAULT_AGENT_SAFETY: NonNullable<Settings['agentSafety']> = {
  maxActions: 120,
  maxFileWrites: 80,
  maxCommands: 24,
  maxBytesWritten: 1_000_000,
  maxContractViolations: 12,
  maxCommandTimeoutMs: 120_000,
  commandKillGraceMs: 2_000,
  maxViolationRetriesPerStep: 2,
}

const DEFAULT_SYSTEM_PROMPTS: NonNullable<Settings['systemPrompts']> = {
  chat: 'You are a helpful AI assistant running locally in AI Agent IDE. You are NOT Claude, ChatGPT, or any cloud AI. You are a local AI model. Provide clear and direct answers. When asked what model you are, describe yourself as a local AI assistant.',
  coding: 'You are a senior software engineer running as a local AI in AI Agent IDE. Return practical, correct code with minimal fluff.',
  plan: 'You are a technical planner in AI Agent IDE. Break work into concrete executable steps and call out risks.',
  build: 'You are a coding agent in build mode within AI Agent IDE. Implement requested changes completely and safely.',
  bugfix: 'You are in bugfix mode within AI Agent IDE. Identify the root cause and provide the minimal robust fix.',
  image: 'You generate image prompts optimized for clear, high-quality outputs.',
}

const DEFAULT_SETTINGS: Settings = {
  ollamaEndpoint: 'http://127.0.0.1:11434',
  modelName: 'glm-4.7-flash',
  codingModel: 'qwen3-coder-30b',
  imageModel: '',
  numCtx: 8192,
  theme: 'glass',
  activeProvider: 'llamacpp',
  codingProvider: 'llamacpp',
  imageProvider: 'ollama',
  llamacppEndpoint: 'http://127.0.0.1:8080',
  llamacppModelName: 'qwen3-coder-30b',
  llamacppBinaryPath: 'C:\\Users\\hotre\\src\\llama.cpp\\build\\bin\\llama-server.exe',
  llamacppModelPath: 'C:\\Users\\hotre\\.lmstudio\\models\\lmstudio-community\\Qwen3-Coder-30B-A3B-Instruct-GGUF\\Qwen3-Coder-30B-A3B-Instruct-Q4_K_M.gguf',
  permissions: { ...DEFAULT_PERMISSIONS },
  agentSafety: { ...DEFAULT_AGENT_SAFETY },
  systemPrompts: { ...DEFAULT_SYSTEM_PROMPTS },
}

// --- Storage Paths ---

function getStorageDir(): string {
  return path.join(app.getPath('userData'), 'app-data')
}

function getConversationsFilePath(): string {
  return path.join(getStorageDir(), 'conversations.json')
}

function getMessagesDir(): string {
  return path.join(getStorageDir(), 'messages')
}

function getMessagesFilePath(conversationId: string): string {
  return path.join(getMessagesDir(), `${conversationId}.json`)
}

function getSettingsFilePath(): string {
  return path.join(getStorageDir(), 'settings.json')
}

// --- Initialization ---

function ensureStorageExists(): void {
  const storageDir = getStorageDir()
  const messagesDir = getMessagesDir()

  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true })
  }

  if (!fs.existsSync(messagesDir)) {
    fs.mkdirSync(messagesDir, { recursive: true })
  }

  const conversationsPath = getConversationsFilePath()
  if (!fs.existsSync(conversationsPath)) {
    fs.writeFileSync(conversationsPath, JSON.stringify([], null, 2), 'utf-8')
  }

  const settingsPath = getSettingsFilePath()
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf-8')
  }
}

// --- Generic File Helpers ---

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback
    }
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJsonFile<T>(filePath: string, data: T): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

// --- Conversation CRUD ---

export function listConversations(): Conversation[] {
  ensureStorageExists()
  const conversations = readJsonFile<Conversation[]>(getConversationsFilePath(), [])
  return conversations.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

export function createConversation(title?: string): Conversation {
  ensureStorageExists()
  const conversations = readJsonFile<Conversation[]>(getConversationsFilePath(), [])
  const now = new Date().toISOString()

  const conversation: Conversation = {
    id: uuidv4(),
    title: title || 'New Conversation',
    createdAt: now,
    updatedAt: now,
  }

  conversations.push(conversation)
  writeJsonFile(getConversationsFilePath(), conversations)

  // Create empty messages file for this conversation
  writeJsonFile(getMessagesFilePath(conversation.id), [])

  return conversation
}

export function deleteConversation(id: string): boolean {
  ensureStorageExists()
  const conversations = readJsonFile<Conversation[]>(getConversationsFilePath(), [])
  const filtered = conversations.filter((c) => c.id !== id)

  if (filtered.length === conversations.length) {
    return false // Not found
  }

  writeJsonFile(getConversationsFilePath(), filtered)

  // Delete messages file
  const messagesPath = getMessagesFilePath(id)
  if (fs.existsSync(messagesPath)) {
    fs.unlinkSync(messagesPath)
  }

  return true
}

export function renameConversation(id: string, title: string): Conversation | null {
  ensureStorageExists()
  const conversations = readJsonFile<Conversation[]>(getConversationsFilePath(), [])
  const conversation = conversations.find((c) => c.id === id)

  if (!conversation) {
    return null
  }

  conversation.title = title
  conversation.updatedAt = new Date().toISOString()
  writeJsonFile(getConversationsFilePath(), conversations)

  return conversation
}

export function updateConversationTimestamp(id: string): void {
  ensureStorageExists()
  const conversations = readJsonFile<Conversation[]>(getConversationsFilePath(), [])
  const conversation = conversations.find((c) => c.id === id)

  if (conversation) {
    conversation.updatedAt = new Date().toISOString()
    writeJsonFile(getConversationsFilePath(), conversations)
  }
}

// --- Message CRUD ---

export function listMessages(conversationId: string): Message[] {
  ensureStorageExists()
  return readJsonFile<Message[]>(getMessagesFilePath(conversationId), [])
}

export function addMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string
): Message {
  ensureStorageExists()
  const messages = readJsonFile<Message[]>(getMessagesFilePath(conversationId), [])

  const message: Message = {
    id: uuidv4(),
    conversationId,
    role,
    content,
    createdAt: new Date().toISOString(),
  }

  messages.push(message)
  writeJsonFile(getMessagesFilePath(conversationId), messages)

  // Update conversation timestamp
  updateConversationTimestamp(conversationId)

  return message
}

export function deleteMessage(conversationId: string, messageId: string): boolean {
  ensureStorageExists()
  const messages = readJsonFile<Message[]>(getMessagesFilePath(conversationId), [])
  const filtered = messages.filter((m) => m.id !== messageId)

  if (filtered.length === messages.length) {
    return false
  }

  writeJsonFile(getMessagesFilePath(conversationId), filtered)
  return true
}

// --- Settings CRUD ---

export function getSettings(): Settings {
  ensureStorageExists()
  const settings = readJsonFile<Settings>(getSettingsFilePath(), DEFAULT_SETTINGS)
  return mergeSettingsWithDefaults(settings)
}

export function setSettings(newSettings: Partial<Settings>): Settings {
  ensureStorageExists()
  const current = getSettings()
  const updated = mergeSettingsWithDefaults({
    ...current,
    ...newSettings,
    permissions: {
      ...DEFAULT_PERMISSIONS,
      ...(current.permissions || {}),
      ...(newSettings.permissions || {}),
    },
    agentSafety: {
      ...DEFAULT_AGENT_SAFETY,
      ...(current.agentSafety || {}),
      ...(newSettings.agentSafety || {}),
    },
    systemPrompts: {
      ...DEFAULT_SYSTEM_PROMPTS,
      ...(current.systemPrompts || {}),
      ...(newSettings.systemPrompts || {}),
    },
  })
  writeJsonFile(getSettingsFilePath(), updated)
  return updated
}

function mergeSettingsWithDefaults(settings: Partial<Settings> | null | undefined): Settings {
  const incoming = settings || {}
  return {
    ...DEFAULT_SETTINGS,
    ...incoming,
    permissions: {
      ...DEFAULT_PERMISSIONS,
      ...(incoming.permissions || {}),
    },
    agentSafety: {
      ...DEFAULT_AGENT_SAFETY,
      ...(incoming.agentSafety || {}),
    },
    systemPrompts: {
      ...DEFAULT_SYSTEM_PROMPTS,
      ...(incoming.systemPrompts || {}),
    },
  }
}

// --- User Files Management ---

function getUserFilesContainerDir(): string {
  return path.join(app.getPath('userData'), 'user-files')
}

export function getUserFilesDir(): string {
  return path.join(getUserFilesContainerDir(), 'projects')
}

export function ensureUserFilesDir(): void {
  const containerDir = getUserFilesContainerDir()
  const projectDir = getUserFilesDir()
  if (!fs.existsSync(containerDir)) {
    fs.mkdirSync(containerDir, { recursive: true })
    console.info('[Store][ensureUserFilesDir] Created container:', containerDir)
  }
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true })
    console.info('[Store][ensureUserFilesDir] Created projects root:', projectDir)
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

function mapStatsToUserFile(filePath: string): UserFile {
  const stats = fs.statSync(filePath)
  const name = path.basename(filePath)
  return {
    name,
    path: filePath,
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
    type: stats.isDirectory() ? 'folder' : (path.extname(name).toLowerCase() || 'unknown'),
    isDirectory: stats.isDirectory(),
  }
}

function mapStatsToUserFileInfo(filePath: string): UserFileInfo {
  const base = mapStatsToUserFile(filePath)
  const stats = fs.statSync(filePath)
  return {
    ...base,
    createdAt: stats.birthtime.toISOString(),
  }
}

function isInsideDir(baseDir: string, targetPath: string): boolean {
  const base = path.resolve(baseDir)
  const target = path.resolve(targetPath)
  return target === base || target.startsWith(base + path.sep)
}

function sanitizeLeafName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed || trimmed === '.' || trimmed === '..') return null
  if (trimmed.includes('/') || trimmed.includes('\\')) return null
  return trimmed
}

export function listUserFiles(): UserFile[] {
  ensureUserFilesDir()
  const dir = getUserFilesDir()
  try {
    console.info('[Store][listUserFiles] Listing directory:', dir)
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    return entries
      .map(e => {
        const fullPath = path.join(dir, e.name)
        return mapStatsToUserFile(fullPath)
      })
      .sort((a, b) => {
        // Folders first, then files
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
      })
  } catch {
    return []
  }
}

export function importUserFile(sourcePath: string): UserFile | null {
  ensureUserFilesDir()
  const fileName = path.basename(sourcePath)
  const destPath = path.join(getUserFilesDir(), fileName)
  try {
    fs.copyFileSync(sourcePath, destPath)
    return mapStatsToUserFile(destPath)
  } catch {
    return null
  }
}

export function deleteUserFile(fileName: string): boolean {
  ensureUserFilesDir()
  const filePath = path.join(getUserFilesDir(), fileName)
  // Safety: ensure path is within user-files dir
  if (!filePath.startsWith(getUserFilesDir())) return false
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      return true
    }
    return false
  } catch {
    return false
  }
}

export function getUserFilesPath(): string {
  ensureUserFilesDir()
  return getUserFilesDir()
}

/**
 * Import a file from raw buffer data (used for drag-and-drop where File.path
 * is not accessible due to contextIsolation).
 */
export function importUserFileFromBuffer(fileName: string, buffer: Buffer): UserFile | null {
  ensureUserFilesDir()
  const destPath = path.join(getUserFilesDir(), fileName)
  try {
    fs.writeFileSync(destPath, buffer)
    return mapStatsToUserFile(destPath)
  } catch {
    return null
  }
}

export function createUserFile(fileName: string, content: string, directory?: string): UserFile | null {
  ensureUserFilesDir()
  const rootDir = getUserFilesDir()
  const safeName = sanitizeLeafName(fileName)
  const resolvedDir = directory
    ? path.resolve(rootDir, directory)
    : rootDir

  console.info('[Store][createUserFile] Called with:', {
    fileName,
    directory,
    rootDir,
    resolvedDir,
  })

  if (!safeName) {
    console.error('[Store][createUserFile] Invalid file name:', fileName)
    return null
  }

  if (!isInsideDir(rootDir, resolvedDir)) {
    console.error('[Store][createUserFile] Security violation for directory:', directory)
    return null
  }

  try {
    fs.mkdirSync(resolvedDir, { recursive: true })
    console.info('[Store][createUserFile] Ensured directory exists:', resolvedDir)
    const filePath = path.resolve(resolvedDir, safeName)
    if (!isInsideDir(rootDir, filePath)) {
      console.error('[Store][createUserFile] Security violation for file path:', filePath)
      return null
    }
    fs.writeFileSync(filePath, content, 'utf-8')
    console.info('[Store][createUserFile] Created file:', filePath)
    return mapStatsToUserFile(filePath)
  } catch (error) {
    console.error('[Store][createUserFile] Failed to create file:', {
      fileName,
      directory,
      error,
    })
    return null
  }
}

export function createUserProject(projectName: string): UserFile | null {
  ensureUserFilesDir()
  const rootDir = getUserFilesDir()
  const safeProjectName = sanitizeLeafName(projectName)

  console.info('[Store][createUserProject] Called with:', {
    projectName,
    rootDir,
  })

  if (!safeProjectName) {
    console.error('[Store][createUserProject] Invalid project name:', projectName)
    return null
  }

  const projectPath = path.resolve(rootDir, safeProjectName)
  if (!isInsideDir(rootDir, projectPath)) {
    console.error('[Store][createUserProject] Security violation for project path:', projectPath)
    return null
  }

  try {
    if (fs.existsSync(projectPath)) {
      console.error('[Store][createUserProject] Project already exists:', projectPath)
      return null
    }

    fs.mkdirSync(projectPath, { recursive: true })
    console.info('[Store][createUserProject] Created project directory:', projectPath)

    const createdAt = new Date().toISOString()
    const projectDocPath = path.join(projectPath, 'PROJECT.md')
    const projectDoc = [
      `# ${safeProjectName}`,
      '',
      `Created: ${createdAt}`,
      `Workspace Root: ${projectPath}`,
      '',
    ].join('\n')
    fs.writeFileSync(projectDocPath, projectDoc, 'utf-8')
    console.info('[Store][createUserProject] Wrote scaffold file:', projectDocPath)

    return mapStatsToUserFile(projectPath)
  } catch (error) {
    console.error('[Store][createUserProject] Failed to create project:', {
      projectName,
      error,
    })
    return null
  }
}

export function renameUserFile(oldName: string, newName: string): UserFile | null {
  ensureUserFilesDir()
  const baseDir = getUserFilesDir()
  const oldPath = path.resolve(path.join(baseDir, oldName))
  const newPath = path.resolve(path.join(baseDir, newName))

  if (!isInsideDir(baseDir, oldPath) || !isInsideDir(baseDir, newPath)) {
    return null
  }

  try {
    fs.renameSync(oldPath, newPath)
    return mapStatsToUserFile(newPath)
  } catch {
    return null
  }
}

export function moveUserFile(fileName: string, destinationDir: string): UserFile | null {
  ensureUserFilesDir()
  const sourcePath = path.resolve(path.join(getUserFilesDir(), fileName))
  if (!isInsideDir(getUserFilesDir(), sourcePath)) {
    return null
  }

  try {
    fs.mkdirSync(destinationDir, { recursive: true })
    const destinationPath = path.resolve(path.join(destinationDir, path.basename(fileName)))
    fs.renameSync(sourcePath, destinationPath)
    return mapStatsToUserFile(destinationPath)
  } catch (error: any) {
    if (error?.code !== 'EXDEV') return null
    try {
      const destinationPath = path.resolve(path.join(destinationDir, path.basename(fileName)))
      fs.copyFileSync(sourcePath, destinationPath)
      fs.unlinkSync(sourcePath)
      return mapStatsToUserFile(destinationPath)
    } catch {
      return null
    }
  }
}

export function duplicateUserFile(sourceName: string, newName?: string): UserFile | null {
  ensureUserFilesDir()
  const baseDir = getUserFilesDir()
  const sourcePath = path.resolve(path.join(baseDir, sourceName))
  if (!isInsideDir(baseDir, sourcePath) || !fs.existsSync(sourcePath)) {
    return null
  }

  const parsed = path.parse(sourceName)
  const defaultName = `${parsed.name}_copy${parsed.ext}`
  const targetName = (newName || defaultName).trim()
  if (!targetName) return null

  const destinationPath = path.resolve(path.join(baseDir, targetName))
  if (!isInsideDir(baseDir, destinationPath)) {
    return null
  }

  try {
    fs.copyFileSync(sourcePath, destinationPath)
    return mapStatsToUserFile(destinationPath)
  } catch {
    return null
  }
}

export function getUserFileInfo(fileName: string): UserFileInfo | null {
  ensureUserFilesDir()
  const filePath = path.resolve(path.join(getUserFilesDir(), fileName))
  if (!isInsideDir(getUserFilesDir(), filePath) || !fs.existsSync(filePath)) {
    return null
  }
  try {
    return mapStatsToUserFileInfo(filePath)
  } catch {
    return null
  }
}

// --- Session State ---

export interface SessionState {
  view: string
  sidebarCollapsed: boolean
  workspaceRootPath: string | null
  showExplorer: boolean
  showTerminal: boolean
}

const DEFAULT_SESSION_STATE: SessionState = {
  view: 'chat',
  sidebarCollapsed: false,
  workspaceRootPath: null,
  showExplorer: false,
  showTerminal: true,
}

function getSessionStatePath(): string {
  return path.join(getStorageDir(), 'session-state.json')
}

export function getSessionState(): SessionState {
  ensureStorageExists()
  return readJsonFile<SessionState>(getSessionStatePath(), DEFAULT_SESSION_STATE)
}

export function setSessionState(state: Partial<SessionState>): void {
  ensureStorageExists()
  const current = getSessionState()
  writeJsonFile(getSessionStatePath(), { ...current, ...state })
}
