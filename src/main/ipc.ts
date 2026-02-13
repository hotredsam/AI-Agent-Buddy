import { ipcMain, IpcMainInvokeEvent, dialog, shell, BrowserWindow } from 'electron'
import { spawn, spawnSync } from 'child_process'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import * as pty from 'node-pty'
import * as store from './store'
import * as agent from './agent-runner'
import { sendMessageStream, checkHealth, listModels, runDiagnostics, pullModel, OllamaChatMessage, StreamMeta } from './ollama'
import { sendOpenAIStream } from './openai'
import { sendAnthropicStream } from './anthropic'
import { sendGoogleStream } from './google'
import { sendGroqStream } from './groq'
import {
  beginRuntimeRequest,
  endRuntimeRequest,
  getRuntimeDiagnostics,
} from './runtime-diagnostics'

// --- PTY Management ---
const ptyProcesses = new Map<number, pty.IPty>()
let nextPtyId = 1
const chatAbortControllers = new Map<string, AbortController>()

interface FolderEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedAt: string
}

type Provider = 'ollama' | 'openai' | 'anthropic' | 'google' | 'groq'

interface TerminalShellOption {
  id: 'powershell' | 'cmd' | 'git-bash' | 'wsl'
  label: string
  command: string
  args: string[]
  available: boolean
}

function commandExists(command: string): boolean {
  if (path.isAbsolute(command)) {
    return fs.existsSync(command)
  }
  try {
    const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], {
      stdio: 'ignore',
      shell: false,
    })
    return probe.status === 0
  } catch {
    return false
  }
}

function listTerminalShellOptions(): TerminalShellOption[] {
  if (process.platform !== 'win32') {
    const sh = commandExists('bash') ? 'bash' : 'sh'
    return [
      {
        id: 'powershell',
        label: sh,
        command: sh,
        args: [],
        available: true,
      },
    ]
  }

  const systemRoot = process.env.SystemRoot || 'C:\\Windows'
  const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files'
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'

  const powerShellExe = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  const cmdExe = path.join(systemRoot, 'System32', 'cmd.exe')
  const wslExe = path.join(systemRoot, 'System32', 'wsl.exe')
  const gitBashCandidates = [
    path.join(programFiles, 'Git', 'bin', 'bash.exe'),
    path.join(programFilesX86, 'Git', 'bin', 'bash.exe'),
  ]
  const gitBashExe = gitBashCandidates.find((candidate) => fs.existsSync(candidate)) || gitBashCandidates[0]

  const powershellCommand = fs.existsSync(powerShellExe)
    ? powerShellExe
    : (commandExists('pwsh') ? 'pwsh' : powerShellExe)

  return [
    {
      id: 'powershell',
      label: 'PowerShell',
      command: powershellCommand,
      args: ['-NoLogo'],
      available: commandExists(powershellCommand),
    },
    {
      id: 'cmd',
      label: 'Command Prompt',
      command: cmdExe,
      args: [],
      available: fs.existsSync(cmdExe),
    },
    {
      id: 'git-bash',
      label: 'Git Bash',
      command: gitBashExe,
      args: ['--login', '-i'],
      available: fs.existsSync(gitBashExe),
    },
    {
      id: 'wsl',
      label: 'WSL',
      command: wslExe,
      args: [],
      available: fs.existsSync(wslExe),
    },
  ]
}

function resolveTerminalShell(shellId?: string): TerminalShellOption {
  const options = listTerminalShellOptions()
  const preferred = options.find((item) => item.id === shellId && item.available)
  if (preferred) return preferred
  const firstAvailable = options.find((item) => item.available)
  return firstAvailable || options[0]
}

function resolveRequestSignal(abortSignal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(600000)
  const anyFn = (AbortSignal as any).any as ((signals: AbortSignal[]) => AbortSignal) | undefined
  if (!abortSignal || typeof anyFn !== 'function') {
    return abortSignal || timeoutSignal
  }
  return anyFn([timeoutSignal, abortSignal])
}

export async function generateCodeWithProvider(
  settings: store.Settings,
  prompt: string,
  context: string,
  providerOverride?: Provider,
  modelOverride?: string,
  mode: 'coding' | 'plan' | 'build' | 'bugfix' = 'coding',
  abortSignal?: AbortSignal
): Promise<{ text: string | null; error?: string }> {
  const provider = providerOverride || settings.codingProvider || settings.activeProvider || 'ollama'
  const model = modelOverride || settings.codingModel || settings.modelName
  const apiKeys = settings.apiKeys || {}
  const systemPromptByMode = settings.systemPrompts || {
    chat: 'You are a helpful AI assistant.',
    coding: 'You are a senior software engineer.',
    plan: 'You are a technical planner.',
    build: 'You are in build mode.',
    bugfix: 'You are in bugfix mode.',
    image: 'You generate image prompts.',
  }
  const modeSystemPrompt =
    mode === 'plan' ? systemPromptByMode.plan :
    mode === 'build' ? systemPromptByMode.build :
    mode === 'bugfix' ? systemPromptByMode.bugfix :
    systemPromptByMode.coding

  const userPrompt = context
    ? `${prompt}\n\nCurrent file context:\n${context}`
    : prompt

  let runtimeRequestId: string | null = null
  try {
    runtimeRequestId = await beginRuntimeRequest({
      provider,
      model,
      kind: mode,
      endpoint: settings.ollamaEndpoint,
    })

    if (provider === 'ollama') {
      const response = await fetch(`${settings.ollamaEndpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          options: { num_ctx: settings.numCtx },
          messages: [
            { role: 'system', content: modeSystemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: resolveRequestSignal(abortSignal),
      })
      if (!response.ok) {
        return { text: null, error: `Ollama error (${response.status})` }
      }
      const data: any = await response.json()
      return { text: data?.message?.content || null }
    }

    if (provider === 'openai') {
      if (!apiKeys.openai) return { text: null, error: 'Missing OpenAI API key.' }
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKeys.openai}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: modeSystemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: resolveRequestSignal(abortSignal),
      })
      if (!response.ok) return { text: null, error: `OpenAI error (${response.status})` }
      const data: any = await response.json()
      return { text: data?.choices?.[0]?.message?.content || null }
    }

    if (provider === 'anthropic') {
      if (!apiKeys.anthropic) return { text: null, error: 'Missing Anthropic API key.' }
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKeys.anthropic,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: modeSystemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        signal: resolveRequestSignal(abortSignal),
      })
      if (!response.ok) return { text: null, error: `Anthropic error (${response.status})` }
      const data: any = await response.json()
      return { text: data?.content?.[0]?.text || null }
    }

    if (provider === 'google') {
      if (!apiKeys.google) return { text: null, error: 'Missing Google API key.' }
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKeys.google)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${modeSystemPrompt}\n\n${userPrompt}` }],
              },
            ],
          }),
          signal: resolveRequestSignal(abortSignal),
        }
      )
      if (!response.ok) return { text: null, error: `Google error (${response.status})` }
      const data: any = await response.json()
      return { text: data?.candidates?.[0]?.content?.parts?.[0]?.text || null }
    }

    if (!apiKeys.groq) return { text: null, error: 'Missing Groq API key.' }
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKeys.groq}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: modeSystemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: resolveRequestSignal(abortSignal),
    })
    if (!response.ok) return { text: null, error: `Groq error (${response.status})` }
    const data: any = await response.json()
    return { text: data?.choices?.[0]?.message?.content || null }
  } catch (error: any) {
    return { text: null, error: error?.message || 'Unknown coding generation error' }
  } finally {
    if (runtimeRequestId) {
      endRuntimeRequest(runtimeRequestId)
    }
  }
}

async function generateImageWithProvider(
  settings: store.Settings,
  prompt: string,
  providerOverride?: Provider,
  modelOverride?: string
): Promise<{ filePath: string | null; error?: string }> {
  const provider = providerOverride || settings.imageProvider || 'openai'
  const model = modelOverride || settings.imageModel || 'gpt-image-1'
  const apiKeys = settings.apiKeys || {}
  const imageSystemPrompt = settings.systemPrompts?.image || ''
  const mergedPrompt = imageSystemPrompt ? `${imageSystemPrompt}\n\n${prompt}` : prompt

  const writeImageBuffer = async (buffer: Buffer): Promise<string> => {
    store.ensureUserFilesDir()
    const fileName = `generated-image-${Date.now()}.png`
    const filePath = path.join(store.getUserFilesPath(), fileName)
    fs.writeFileSync(filePath, buffer)
    return filePath
  }

  let runtimeRequestId: string | null = null
  try {
    runtimeRequestId = await beginRuntimeRequest({
      provider,
      model,
      kind: 'image',
      endpoint: settings.ollamaEndpoint,
    })

    if (provider === 'openai') {
      if (!apiKeys.openai) return { filePath: null, error: 'Missing OpenAI API key.' }
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKeys.openai}`,
        },
        body: JSON.stringify({
          model,
          prompt: mergedPrompt,
          size: '1024x1024',
          response_format: 'b64_json',
        }),
      })
      if (!response.ok) return { filePath: null, error: `OpenAI image error (${response.status})` }
      const data: any = await response.json()
      const b64 = data?.data?.[0]?.b64_json
      if (!b64) return { filePath: null, error: 'Image response missing data.' }
      const filePath = await writeImageBuffer(Buffer.from(b64, 'base64'))
      return { filePath }
    }

    if (provider === 'ollama') {
      const response = await fetch(`${settings.ollamaEndpoint}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt: mergedPrompt,
          size: '1024x1024',
          response_format: 'b64_json',
        }),
      })
      if (!response.ok) {
        const details = await response.text()
        return { filePath: null, error: `Ollama image error (${response.status}): ${details || 'Unknown error'}` }
      }
      const data: any = await response.json()
      const b64 = data?.data?.[0]?.b64_json
      if (typeof b64 === 'string' && b64.length > 0) {
        const filePath = await writeImageBuffer(Buffer.from(b64, 'base64'))
        return { filePath }
      }
      const imageUrl = data?.data?.[0]?.url
      if (typeof imageUrl === 'string' && imageUrl.length > 0) {
        const imageResponse = await fetch(imageUrl)
        if (!imageResponse.ok) {
          return { filePath: null, error: `Failed to download generated image (${imageResponse.status}).` }
        }
        const buffer = Buffer.from(await imageResponse.arrayBuffer())
        const filePath = await writeImageBuffer(buffer)
        return { filePath }
      }
      return { filePath: null, error: 'Ollama image response missing image data.' }
    }

    return { filePath: null, error: `Image generation for provider "${provider}" is not configured yet.` }
  } catch (error: any) {
    return { filePath: null, error: error?.message || 'Unknown image generation error' }
  } finally {
    if (runtimeRequestId) {
      endRuntimeRequest(runtimeRequestId)
    }
  }
}

function isImagePrompt(text: string): boolean {
  const lower = text.toLowerCase()
  return lower.startsWith('/image ') || lower.includes('generate image') || lower.includes('create an image')
}

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
      const existingController = chatAbortControllers.get(conversationId)
      if (existingController) {
        existingController.abort()
      }
      const abortController = new AbortController()
      chatAbortControllers.set(conversationId, abortController)

      // Get current settings, merge with any overrides
      const currentSettings = store.getSettings()
      const effectiveSettings = settings
        ? { ...currentSettings, ...settings }
        : currentSettings

      // Save the user message
      store.addMessage(conversationId, 'user', userText)

      if (isImagePrompt(userText)) {
        const imagePrompt = userText.replace(/^\/image\s*/i, '').trim() || userText
        const imageResult = await generateImageWithProvider(effectiveSettings, imagePrompt)
        if (imageResult.filePath) {
          const normalizedImagePath = imageResult.filePath.replace(/\\/g, '/')
          const message = `![Generated image](${normalizedImagePath})\n\nImage generated and saved:\n${imageResult.filePath}`
          store.addMessage(conversationId, 'assistant', message)
          event.sender.send('chat:done', { conversationId, fullResponse: message })
        } else {
          event.sender.send('chat:error', {
            conversationId,
            error: imageResult.error || 'Image generation failed.',
          })
        }
        return
      }

      // Build messages array for Ollama (full conversation history)
      const allMessages = store.listMessages(conversationId)
      const ollamaMessages: OllamaChatMessage[] = allMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))
      const chatSystemPrompt = settings?.systemPrompts?.chat || currentSettings.systemPrompts?.chat
      if (chatSystemPrompt) {
        ollamaMessages.unshift({ role: 'system', content: chatSystemPrompt })
      }

      // Stream response from configured provider
      let fullResponse = ''
      const provider = effectiveSettings.activeProvider || 'ollama'
      let runtimeRequestId: string | null = null

      try {
        runtimeRequestId = await beginRuntimeRequest({
          provider,
          model: effectiveSettings.modelName,
          kind: 'chat',
          endpoint: effectiveSettings.ollamaEndpoint,
        })

        const apiKeys = effectiveSettings.apiKeys || {}
        let stream: AsyncGenerator<string, void, unknown>

        if (provider === 'openai') {
          if (!apiKeys.openai) {
            throw new Error('OpenAI API key is missing. Add it in Settings > API Keys.')
          }
          stream = sendOpenAIStream(apiKeys.openai, effectiveSettings.modelName, ollamaMessages, abortController.signal)
        } else if (provider === 'anthropic') {
          if (!apiKeys.anthropic) {
            throw new Error('Anthropic API key is missing. Add it in Settings > API Keys.')
          }
          stream = sendAnthropicStream(apiKeys.anthropic, effectiveSettings.modelName, ollamaMessages, abortController.signal)
        } else if (provider === 'google') {
          if (!apiKeys.google) {
            throw new Error('Google API key is missing. Add it in Settings > API Keys.')
          }
          stream = sendGoogleStream(apiKeys.google, effectiveSettings.modelName, ollamaMessages, abortController.signal)
        } else if (provider === 'groq') {
          if (!apiKeys.groq) {
            throw new Error('Groq API key is missing. Add it in Settings > API Keys.')
          }
          stream = sendGroqStream(apiKeys.groq, effectiveSettings.modelName, ollamaMessages, abortController.signal)
        } else {
          stream = sendMessageStream(
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
            },
            abortController.signal
          )
        }

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
          if ((effectiveSettings.activeProvider || 'ollama') === 'ollama') {
            errorMessage = `Cannot connect to Ollama. Make sure it's running: ollama serve`
          } else {
            errorMessage = `Network request failed to the active provider API. Check internet access, API key, and model name.`
          }
        } else if (lower.includes('abort') || lower.includes('cancel')) {
          errorMessage = `Request cancelled.`
        } else if (lower.includes('timeout') || lower.includes('aborted')) {
          errorMessage = `Request timed out. Check model availability and try again.`
        }

        console.error('[Chat Provider Error]', error)

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
      } finally {
        if (runtimeRequestId) {
          endRuntimeRequest(runtimeRequestId)
        }
        if (chatAbortControllers.get(conversationId) === abortController) {
          chatAbortControllers.delete(conversationId)
        }
      }
    }
  )

  ipcMain.handle('chat:cancel', async (_event: IpcMainInvokeEvent, conversationId: string): Promise<boolean> => {
    const controller = chatAbortControllers.get(conversationId)
    if (!controller) return false
    controller.abort()
    chatAbortControllers.delete(conversationId)
    return true
  })

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

  ipcMain.handle(
    'ai:generateCode',
    async (
      _event: IpcMainInvokeEvent,
      payload: {
        prompt: string
        context?: string
        provider?: Provider
        model?: string
        mode?: 'coding' | 'plan' | 'build' | 'bugfix'
      }
    ): Promise<{ text: string | null; error?: string }> => {
      const settings = store.getSettings()
      return generateCodeWithProvider(
        settings,
        payload.prompt,
        payload.context || '',
        payload.provider,
        payload.model,
        payload.mode || 'coding'
      )
    }
  )

  ipcMain.handle(
    'ai:generateImage',
    async (
      _event: IpcMainInvokeEvent,
      payload: { prompt: string; provider?: Provider; model?: string }
    ): Promise<{ filePath: string | null; error?: string }> => {
      const settings = store.getSettings()
      return generateImageWithProvider(settings, payload.prompt, payload.provider, payload.model)
    }
  )

  ipcMain.handle('runtime:getDiagnostics', async () => {
    return getRuntimeDiagnostics()
  })

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

  ipcMain.handle(
    'ollama:pullModel',
    async (_event: IpcMainInvokeEvent, modelName: string): Promise<boolean> => {
      const settings = store.getSettings()
      return pullModel(settings.ollamaEndpoint, modelName)
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

  ipcMain.handle(
    'files:createFile',
    async (
      _event: IpcMainInvokeEvent,
      fileName: string,
      content: string,
      directory?: string
    ): Promise<store.UserFile | null> => {
      console.info('[IPC][files:createFile] Request received:', { fileName, directory })
      try {
        return store.createUserFile(fileName, content, directory)
      } catch (error) {
        console.error('[IPC][files:createFile] Failed:', error)
        return null
      }
    }
  )

  ipcMain.handle(
    'files:createProject',
    async (_event: IpcMainInvokeEvent, projectName: string): Promise<store.UserFile | null> => {
      console.info('[IPC][files:createProject] Request received:', { projectName })
      try {
        return store.createUserProject(projectName)
      } catch (error) {
        console.error('[IPC][files:createProject] Failed:', error)
        return null
      }
    }
  )

  ipcMain.handle(
    'files:saveAs',
    async (_event: IpcMainInvokeEvent, sourcePath: string): Promise<boolean> => {
      const result = await dialog.showSaveDialog({
        defaultPath: path.basename(sourcePath),
      })
      if (result.canceled || !result.filePath) return false
      try {
        fs.copyFileSync(sourcePath, result.filePath)
        return true
      } catch {
        return false
      }
    }
  )

  ipcMain.handle(
    'files:renameFile',
    async (_event: IpcMainInvokeEvent, oldName: string, newName: string): Promise<store.UserFile | null> => {
      return store.renameUserFile(oldName, newName)
    }
  )

  ipcMain.handle(
    'files:moveFile',
    async (
      _event: IpcMainInvokeEvent,
      fileName: string,
      destinationDir?: string
    ): Promise<store.UserFile | null> => {
      let targetDir = destinationDir
      if (!targetDir) {
        const pick = await dialog.showOpenDialog({
          properties: ['openDirectory', 'createDirectory'],
          title: 'Move File To',
        })
        if (pick.canceled || pick.filePaths.length === 0) return null
        targetDir = pick.filePaths[0]
      }
      return store.moveUserFile(fileName, targetDir)
    }
  )

  ipcMain.handle(
    'files:duplicateFile',
    async (
      _event: IpcMainInvokeEvent,
      sourceName: string,
      newName?: string
    ): Promise<store.UserFile | null> => {
      return store.duplicateUserFile(sourceName, newName)
    }
  )

  ipcMain.handle(
    'files:getFileInfo',
    async (_event: IpcMainInvokeEvent, fileName: string): Promise<store.UserFileInfo | null> => {
      return store.getUserFileInfo(fileName)
    }
  )

  ipcMain.handle(
    'files:showInExplorer',
    async (_event: IpcMainInvokeEvent, filePath: string): Promise<boolean> => {
      try {
        shell.showItemInFolder(filePath)
        return true
      } catch {
        return false
      }
    }
  )

  ipcMain.handle(
    'files:openExternal',
    async (_event: IpcMainInvokeEvent, filePath: string): Promise<boolean> => {
      try {
        const result = await shell.openPath(filePath)
        return result === ''
      } catch {
        return false
      }
    }
  )

  ipcMain.handle('workspace:pickFolder', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Open Folder',
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('workspace:pickFile', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: 'Open File',
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(
    'workspace:listFolder',
    async (_event: IpcMainInvokeEvent, folderPath: string): Promise<FolderEntry[]> => {
      try {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true })
        return entries
          .map((entry) => {
            const fullPath = path.join(folderPath, entry.name)
            const stats = fs.statSync(fullPath)
            return {
              name: entry.name,
              path: fullPath,
              isDirectory: entry.isDirectory(),
              size: stats.size,
              modifiedAt: stats.mtime.toISOString(),
            }
          })
          .sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
            return a.name.localeCompare(b.name)
          })
      } catch {
        return []
      }
    }
  )

  ipcMain.handle(
    'workspace:createFile',
    async (
      _event: IpcMainInvokeEvent,
      parentPath: string,
      fileName: string,
      content = ''
    ): Promise<boolean> => {
      try {
        fs.writeFileSync(path.join(parentPath, fileName), content, 'utf-8')
        return true
      } catch {
        return false
      }
    }
  )

  ipcMain.handle(
    'workspace:createFolder',
    async (
      _event: IpcMainInvokeEvent,
      parentPath: string,
      folderName: string
    ): Promise<boolean> => {
      try {
        fs.mkdirSync(path.join(parentPath, folderName), { recursive: true })
        return true
      } catch {
        return false
      }
    }
  )

  ipcMain.handle(
    'workspace:renamePath',
    async (
      _event: IpcMainInvokeEvent,
      targetPath: string,
      nextName: string
    ): Promise<string | null> => {
      try {
        const nextPath = path.join(path.dirname(targetPath), nextName)
        fs.renameSync(targetPath, nextPath)
        return nextPath
      } catch {
        return null
      }
    }
  )

  ipcMain.handle(
    'workspace:deletePath',
    async (_event: IpcMainInvokeEvent, targetPath: string): Promise<boolean> => {
      try {
        const stats = fs.statSync(targetPath)
        if (stats.isDirectory()) {
          fs.rmSync(targetPath, { recursive: true, force: true })
        } else {
          fs.unlinkSync(targetPath)
        }
        return true
      } catch {
        return false
      }
    }
  )

  ipcMain.handle('system:getStats', async () => {
    return {
      freeMem: os.freemem(),
      totalMem: os.totalmem(),
      platform: os.platform(),
      cpus: os.cpus().length,
    }
  })

  // --- Window Controls (frameless window) ---

  ipcMain.handle('window:minimize', async (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.handle('window:maximize', async (event): Promise<boolean> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    if (win.isFullScreen()) {
      win.setFullScreen(false)
      return false
    }
    if (win?.isMaximized()) {
      win.unmaximize()
      return false
    } else {
      win?.maximize()
      return true
    }
  })

  ipcMain.handle('window:restore', async (event): Promise<void> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isFullScreen()) {
      win.setFullScreen(false)
    }
    if (win.isMaximized()) {
      win.restore()
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

  // --- Agent Handlers ---

  ipcMain.handle(
    'agent:createTask',
    async (
      _event,
      payload: string | {
        goal: string
        mode?: agent.AgentMode
        workspaceRootPath?: string | null
        autoRunPipeline?: boolean
      }
    ) => {
      return agent.createAgentTask(payload)
    }
  )

  ipcMain.handle('agent:cancelTask', async (_event, id: string) => {
    return agent.cancelAgentTask(id)
  })

  ipcMain.handle('agent:listTasks', async () => {
    return agent.listAgentTasks()
  })

  ipcMain.handle('agent:getTask', async (_event, id: string) => {
    return agent.getAgentTask(id)
  })

  ipcMain.handle('agent:approveTask', async (_event, id: string) => {
    return agent.approveAgentTask(id)
  })

  if (process.env.NODE_ENV === 'test') {
    ipcMain.handle('test:agent:createFixture', async (_event, payload?: Partial<agent.AgentTask>) => {
      return agent.createAgentTaskFixtureForTest(payload || {})
    })

    ipcMain.handle('test:agent:clear', async () => {
      agent.clearAgentTasksForTest()
      return true
    })
  }

  // --- Terminal PTY Handlers ---

  ipcMain.handle('terminal:listShells', async () => {
    return listTerminalShellOptions().map((item) => ({
      id: item.id,
      label: item.label,
      available: item.available,
    }))
  })

  ipcMain.handle(
    'terminal:spawn',
    async (
      event: IpcMainInvokeEvent,
      options: { cwd?: string; cols?: number; rows?: number; shellId?: string }
    ): Promise<number> => {
      const shell = resolveTerminalShell(options.shellId)
      if (!shell.available) {
        throw new Error(`Requested shell "${options.shellId || shell.id}" is not available on this system.`)
      }
      const ptyId = nextPtyId++
      
      const ptyProcess = pty.spawn(shell.command, shell.args, {
        name: 'xterm-256color',
        cols: options.cols || 80,
        rows: options.rows || 24,
        cwd: options.cwd || os.homedir(),
        env: process.env as any,
      })

      console.info('[IPC][terminal:spawn] Spawned shell', {
        ptyId,
        shellId: shell.id,
        shellCommand: shell.command,
      })

      const sendSafe = (channel: string, payload: any) => {
        try {
          if (!event.sender.isDestroyed()) {
            event.sender.send(channel, payload)
          }
        } catch {
          // Renderer is gone; ignore send failures.
        }
      }

      ptyProcess.onData((data) => {
        sendSafe(`terminal:data:${ptyId}`, data)
      })

      ptyProcess.onExit(({ exitCode, signal }) => {
        sendSafe(`terminal:exit:${ptyId}`, { exitCode, signal })
        ptyProcesses.delete(ptyId)
      })

      ptyProcesses.set(ptyId, ptyProcess)

      event.sender.once('destroyed', () => {
        const proc = ptyProcesses.get(ptyId)
        if (!proc) return
        try {
          proc.kill()
        } catch {
          // Ignore kill errors for already-exited PTYs.
        }
        ptyProcesses.delete(ptyId)
      })

      return ptyId
    }
  )

  ipcMain.handle('terminal:write', async (_event, ptyId: number, data: string): Promise<void> => {
    const ptyProcess = ptyProcesses.get(ptyId)
    if (ptyProcess) {
      ptyProcess.write(data)
    }
  })

  ipcMain.handle('terminal:resize', async (_event, ptyId: number, cols: number, rows: number): Promise<void> => {
    const ptyProcess = ptyProcesses.get(ptyId)
    if (ptyProcess) {
      ptyProcess.resize(cols, rows)
    }
  })

  ipcMain.handle('terminal:kill', async (_event, ptyId: number): Promise<void> => {
    const ptyProcess = ptyProcesses.get(ptyId)
    if (ptyProcess) {
      ptyProcess.kill()
      ptyProcesses.delete(ptyId)
    }
  })

  // --- Terminal Legacy Handlers ---

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
