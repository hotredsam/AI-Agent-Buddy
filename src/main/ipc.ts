import { ipcMain, IpcMainInvokeEvent, dialog, shell, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import * as os from 'os'
import * as fs from 'fs'
import * as store from './store'
import { sendMessageStream, checkHealth, listModels, runDiagnostics, OllamaChatMessage, StreamMeta } from './ollama'

/**
 * Registers all IPC handlers for the application.
 * Must be called once during app initialization, before creating BrowserWindows.
 */
export function registerIpcHandlers(): void {
  // --- Conversation Handlers ---

  ipcMain.handle(
    'chat:listConversations',
    async (): Promise<store.Conversation[]> => {
      return store.listConversations()
    }
  )

  ipcMain.handle(
    'chat:createConversation',
    async (): Promise<store.Conversation> => {
      return store.createConversation()
    }
  )

  ipcMain.handle(
    'chat:deleteConversation',
    async (_event: IpcMainInvokeEvent, id: string): Promise<boolean> => {
      return store.deleteConversation(id)
    }
  )

  ipcMain.handle(
    'chat:renameConversation',
    async (
      _event: IpcMainInvokeEvent,
      id: string,
      title: string
    ): Promise<store.Conversation | null> => {
      return store.renameConversation(id, title)
    }
  )

  // --- Message Handlers ---

  ipcMain.handle(
    'chat:listMessages',
    async (
      _event: IpcMainInvokeEvent,
      conversationId: string
    ): Promise<store.Message[]> => {
      return store.listMessages(conversationId)
    }
  )

  ipcMain.handle(
    'chat:sendMessage',
    async (
      event: IpcMainInvokeEvent,
      conversationId: string,
      userText: string,
      settings?: Partial<store.Settings>
    ): Promise<void> => {
      // Get current settings, merge with any overrides
      const currentSettings = store.getSettings()
      const effectiveSettings = settings
        ? { ...currentSettings, ...settings }
        : currentSettings

      // Save the user message
      store.addMessage(conversationId, 'user', userText)

      // Build messages array for Ollama (full conversation history)
      const allMessages = store.listMessages(conversationId)
      const ollamaMessages: OllamaChatMessage[] = allMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      // Stream response from Ollama
      let fullResponse = ''

      try {
        const stream = sendMessageStream(
          effectiveSettings.ollamaEndpoint,
          effectiveSettings.modelName,
          ollamaMessages,
          effectiveSettings.numCtx,
          (meta: StreamMeta) => {
            // Notify renderer of effective context window
            event.sender.send('chat:contextInfo', {
              conversationId,
              requestedCtx: meta.requestedCtx,
              effectiveCtx: meta.effectiveCtx,
              wasClamped: meta.wasClamped,
            })
          }
        )

        for await (const token of stream) {
          fullResponse += token
          // Send each token to the renderer
          event.sender.send('chat:token', {
            conversationId,
            token,
          })
        }

        // Save the complete assistant message
        store.addMessage(conversationId, 'assistant', fullResponse)

        // Notify the renderer that streaming is complete
        event.sender.send('chat:done', {
          conversationId,
          fullResponse,
        })
      } catch (error) {
        let errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred'

        // Make error messages more actionable
        const lower = errorMessage.toLowerCase()
        if (lower.includes('failed to load') || lower.includes('resource limitation')) {
          errorMessage = `Model failed to load. Try: (1) Lower context window in Settings, (2) Close other GPU apps, (3) Restart Ollama, (4) Try a smaller model.`
        } else if (lower.includes('econnrefused') || lower.includes('fetch failed')) {
          errorMessage = `Cannot connect to Ollama. Make sure it's running: ollama serve`
        } else if (lower.includes('timeout') || lower.includes('aborted')) {
          errorMessage = `Request timed out. The model may be too large for your system. Try lowering context window in Settings.`
        }

        console.error('[Ollama Error]', error)

        // If we got a partial response, save it
        if (fullResponse.length > 0) {
          store.addMessage(
            conversationId,
            'assistant',
            fullResponse + '\n\n[Error: Stream interrupted]'
          )
        }

        // Notify the renderer of the error
        event.sender.send('chat:error', {
          conversationId,
          error: errorMessage,
        })
      }
    }
  )

  // --- Settings Handlers ---

  ipcMain.handle(
    'settings:get',
    async (): Promise<store.Settings> => {
      return store.getSettings()
    }
  )

  ipcMain.handle(
    'settings:set',
    async (
      _event: IpcMainInvokeEvent,
      settings: Partial<store.Settings>
    ): Promise<store.Settings> => {
      return store.setSettings(settings)
    }
  )

  // --- Ollama Health Check ---

  ipcMain.handle(
    'ollama:health',
    async (): Promise<boolean> => {
      const settings = store.getSettings()
      return checkHealth(settings.ollamaEndpoint)
    }
  )

  ipcMain.handle(
    'ollama:listModels',
    async (): Promise<string[]> => {
      const settings = store.getSettings()
      return listModels(settings.ollamaEndpoint)
    }
  )

  ipcMain.handle(
    'ollama:diagnostics',
    async (): Promise<{
      serverReachable: boolean
      availableModels: string[]
      modelFound: boolean
      error: string | null
    }> => {
      const settings = store.getSettings()
      return runDiagnostics(settings.ollamaEndpoint, settings.modelName)
    }
  )

  // --- User Files Handlers ---

  ipcMain.handle('files:list', async (): Promise<store.UserFile[]> => {
    return store.listUserFiles()
  })

  ipcMain.handle('files:import', async (): Promise<store.UserFile | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: 'Import File',
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return store.importUserFile(result.filePaths[0])
  })

  ipcMain.handle(
    'files:delete',
    async (_event: IpcMainInvokeEvent, fileName: string): Promise<boolean> => {
      return store.deleteUserFile(fileName)
    }
  )

  ipcMain.handle('files:openFolder', async (): Promise<void> => {
    const dir = store.getUserFilesPath()
    shell.openPath(dir)
  })

  // --- Window Controls (frameless window) ---

  ipcMain.handle('window:minimize', async (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.handle('window:maximize', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })

  ipcMain.handle('window:close', async (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle('window:isMaximized', async (event): Promise<boolean> => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })

  // --- Drag-Drop File Import ---

  ipcMain.handle(
    'files:importByPath',
    async (_event: IpcMainInvokeEvent, filePath: string): Promise<store.UserFile | null> => {
      return store.importUserFile(filePath)
    }
  )

  // Import file from buffer (drag-and-drop with contextIsolation)
  ipcMain.handle(
    'files:importByBuffer',
    async (_event: IpcMainInvokeEvent, fileName: string, buffer: ArrayBuffer): Promise<store.UserFile | null> => {
      return store.importUserFileFromBuffer(fileName, Buffer.from(buffer))
    }
  )

  // --- Cloud Checkpoint ---

  ipcMain.handle('checkpoint:generate', async (): Promise<string> => {
    const settings = store.getSettings()
    const conversations = store.listConversations()
    const files = store.listUserFiles()

    const prompt = [
      '# Cloud Checkpoint — AI Agent IDE',
      '',
      '## Project Status',
      `- Files in library: ${files.length}`,
      `- Active conversations: ${conversations.length}`,
      `- Model: ${settings.modelName}`,
      `- Context window: ${settings.numCtx}`,
      `- Theme: ${settings.theme}`,
      '',
      '## Architecture',
      '- Electron + React + TypeScript + Vite',
      '- Main process: IPC handlers, Ollama API, JSON store',
      '- Renderer: React chat UI, settings, file manager, themes',
      '',
      '## Review Request',
      'Review the architecture and suggest optimizations.',
    ].join('\n')

    return prompt
  })

  // --- Terminal Handlers ---

  ipcMain.handle(
    'terminal:execute',
    async (
      _event: IpcMainInvokeEvent,
      command: string,
      cwd: string
    ): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
      return new Promise((resolve) => {
        const stdout: string[] = []
        const stderr: string[] = []
        let killed = false

        const child = spawn(command, [], {
          cwd,
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        })

        const timeout = setTimeout(() => {
          killed = true
          child.kill('SIGTERM')
          // Force kill if SIGTERM doesn't work after 2 seconds
          setTimeout(() => {
            try {
              child.kill('SIGKILL')
            } catch {
              // Process already exited
            }
          }, 2000)
        }, 30_000)

        child.stdout?.on('data', (data: Buffer) => {
          stdout.push(data.toString())
        })

        child.stderr?.on('data', (data: Buffer) => {
          stderr.push(data.toString())
        })

        child.on('close', (code: number | null) => {
          clearTimeout(timeout)
          resolve({
            stdout: stdout.join(''),
            stderr: killed
              ? stderr.join('') + '\n[Process killed: 30s timeout exceeded]'
              : stderr.join(''),
            exitCode: code ?? (killed ? 137 : 1),
          })
        })

        child.on('error', (err: Error) => {
          clearTimeout(timeout)
          resolve({
            stdout: '',
            stderr: err.message,
            exitCode: 1,
          })
        })
      })
    }
  )

  ipcMain.handle(
    'terminal:getCwd',
    async (): Promise<string> => {
      return os.homedir()
    }
  )

  // --- File Read/Write Handlers ---

  ipcMain.handle(
    'files:readFile',
    async (
      _event: IpcMainInvokeEvent,
      filePath: string
    ): Promise<string | null> => {
      try {
        return fs.readFileSync(filePath, 'utf-8')
      } catch {
        return null
      }
    }
  )

  ipcMain.handle(
    'files:writeFile',
    async (
      _event: IpcMainInvokeEvent,
      filePath: string,
      content: string
    ): Promise<boolean> => {
      try {
        fs.writeFileSync(filePath, content, 'utf-8')
        return true
      } catch {
        return false
      }
    }
  )
}
