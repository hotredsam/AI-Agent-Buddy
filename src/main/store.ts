import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'

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
  activeProvider?: 'ollama' | 'openai' | 'anthropic' | 'google' | 'groq'
  codingProvider?: 'ollama' | 'openai' | 'anthropic' | 'google' | 'groq'
  imageProvider?: 'ollama' | 'openai' | 'anthropic' | 'google' | 'groq'
}

// --- Default Settings ---

const DEFAULT_SETTINGS: Settings = {
  ollamaEndpoint: 'http://127.0.0.1:11434',
  modelName: 'glm-4.7-flash',
  codingModel: 'glm-4.7-flash',
  imageModel: 'gpt-image-1',
  numCtx: 8192,
  theme: 'glass',
  codingProvider: 'ollama',
  imageProvider: 'openai',
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
  // Merge with defaults to ensure all keys exist (forward compatibility)
  return { ...DEFAULT_SETTINGS, ...settings }
}

export function setSettings(newSettings: Partial<Settings>): Settings {
  ensureStorageExists()
  const current = getSettings()
  const updated = { ...current, ...newSettings }
  writeJsonFile(getSettingsFilePath(), updated)
  return updated
}

// --- User Files Management ---

export function getUserFilesDir(): string {
  return path.join(app.getPath('userData'), 'user-files')
}

export function ensureUserFilesDir(): void {
  const dir = getUserFilesDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export interface UserFile {
  name: string
  path: string
  size: number
  modifiedAt: string
  type: string
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
    type: path.extname(name).toLowerCase() || 'unknown',
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

export function listUserFiles(): UserFile[] {
  ensureUserFilesDir()
  const dir = getUserFilesDir()
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    return entries
      .filter(e => e.isFile())
      .map(e => {
        const fullPath = path.join(dir, e.name)
        return mapStatsToUserFile(fullPath)
      })
      .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
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
  const targetDir = directory || getUserFilesDir()
  const resolvedDir = path.resolve(targetDir)

  try {
    fs.mkdirSync(resolvedDir, { recursive: true })
    const filePath = path.join(resolvedDir, fileName)
    fs.writeFileSync(filePath, content, 'utf-8')
    return mapStatsToUserFile(filePath)
  } catch {
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
