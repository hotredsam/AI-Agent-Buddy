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
  numCtx: number
  theme: string
  apiKeys?: Record<string, string>
  permissions?: {
    allowTerminal: boolean
    allowFileWrite: boolean
    allowAICodeExec: boolean
  }
  activeProvider?: 'ollama' | 'openai' | 'anthropic' | 'google' | 'groq'
}

// --- Default Settings ---

const DEFAULT_SETTINGS: Settings = {
  ollamaEndpoint: 'http://127.0.0.1:11434',
  modelName: 'glm-4.7-flash',
  numCtx: 8192,
  theme: 'glass',
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

export function listUserFiles(): UserFile[] {
  ensureUserFilesDir()
  const dir = getUserFilesDir()
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    return entries
      .filter(e => e.isFile())
      .map(e => {
        const fullPath = path.join(dir, e.name)
        const stats = fs.statSync(fullPath)
        const ext = path.extname(e.name).toLowerCase()
        return {
          name: e.name,
          path: fullPath,
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
          type: ext || 'unknown',
        }
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
    const stats = fs.statSync(destPath)
    return {
      name: fileName,
      path: destPath,
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      type: path.extname(fileName).toLowerCase() || 'unknown',
    }
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
    const stats = fs.statSync(destPath)
    return {
      name: fileName,
      path: destPath,
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      type: path.extname(fileName).toLowerCase() || 'unknown',
    }
  } catch {
    return null
  }
}
