import { contextBridge, ipcRenderer } from 'electron'

console.log('[Preload] Script started')

contextBridge.exposeInMainWorld('electronAPI', {
  // --- Conversations ---
  listConversations: () => ipcRenderer.invoke('chat:listConversations'),

  createConversation: () => ipcRenderer.invoke('chat:createConversation'),

  deleteConversation: (id: string) =>
    ipcRenderer.invoke('chat:deleteConversation', id),

  renameConversation: (id: string, title: string) =>
    ipcRenderer.invoke('chat:renameConversation', id, title),

  // --- Messages ---
  listMessages: (conversationId: string) =>
    ipcRenderer.invoke('chat:listMessages', conversationId),

  sendMessage: (conversationId: string, text: string, settings?: any) =>
    ipcRenderer.invoke('chat:sendMessage', conversationId, text, settings),
  cancelMessage: (conversationId: string) =>
    ipcRenderer.invoke('chat:cancel', conversationId),

  // --- Settings ---
  getSettings: () => ipcRenderer.invoke('settings:get'),

  setSettings: (settings: any) =>
    ipcRenderer.invoke('settings:set', settings),

  // --- Health Check ---
  checkHealth: () => ipcRenderer.invoke('ollama:health'),
  listModels: () => ipcRenderer.invoke('ollama:listModels'),
  listImageModels: () => ipcRenderer.invoke('ollama:listImageModels'),
  runDiagnostics: () => ipcRenderer.invoke('ollama:diagnostics'),
  pullModel: (modelName: string) => ipcRenderer.invoke('ollama:pullModel', modelName),

  // --- Streaming Event Listeners ---
  onToken: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('chat:token', handler)
    return () => ipcRenderer.removeListener('chat:token', handler)
  },

  onDone: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('chat:done', handler)
    return () => ipcRenderer.removeListener('chat:done', handler)
  },

  onError: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('chat:error', handler)
    return () => ipcRenderer.removeListener('chat:error', handler)
  },

  onContextInfo: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('chat:contextInfo', handler)
    return () => ipcRenderer.removeListener('chat:contextInfo', handler)
  },

  // --- User Files ---
  listFiles: () => ipcRenderer.invoke('files:list'),
  importFile: () => ipcRenderer.invoke('files:import'),
  importFileByPath: (filePath: string) => ipcRenderer.invoke('files:importByPath', filePath),
  importFileByBuffer: (fileName: string, buffer: ArrayBuffer) =>
    ipcRenderer.invoke('files:importByBuffer', fileName, buffer),
  deleteFile: (fileName: string) => ipcRenderer.invoke('files:delete', fileName),
  openFilesFolder: () => ipcRenderer.invoke('files:openFolder'),
  createFile: (fileName: string, content: string, directory?: string) =>
    ipcRenderer.invoke('files:createFile', fileName, content, directory),
  createProject: (projectName: string) => {
    console.info('[Preload] createProject invoked:', projectName)
    return ipcRenderer.invoke('files:createProject', projectName)
  },
  saveFileAs: (sourcePath: string) => ipcRenderer.invoke('files:saveAs', sourcePath),
  renameFile: (oldName: string, newName: string) =>
    ipcRenderer.invoke('files:renameFile', oldName, newName),
  moveFile: (fileName: string, destinationDir?: string) =>
    ipcRenderer.invoke('files:moveFile', fileName, destinationDir),
  duplicateFile: (sourceName: string, newName?: string) =>
    ipcRenderer.invoke('files:duplicateFile', sourceName, newName),
  getFileInfo: (fileName: string) => ipcRenderer.invoke('files:getFileInfo', fileName),
  showInExplorer: (filePath: string) => ipcRenderer.invoke('files:showInExplorer', filePath),
  openExternal: (filePath: string) => ipcRenderer.invoke('files:openExternal', filePath),
  pickWorkspaceFolder: () => ipcRenderer.invoke('workspace:pickFolder'),
  pickWorkspaceFile: () => ipcRenderer.invoke('workspace:pickFile'),
  listWorkspaceFolder: (folderPath: string) => ipcRenderer.invoke('workspace:listFolder', folderPath),
  createWorkspaceFile: (parentPath: string, fileName: string, content?: string) =>
    ipcRenderer.invoke('workspace:createFile', parentPath, fileName, content),
  createWorkspaceFolder: (parentPath: string, folderName: string) =>
    ipcRenderer.invoke('workspace:createFolder', parentPath, folderName),
  renameWorkspacePath: (targetPath: string, nextName: string) =>
    ipcRenderer.invoke('workspace:renamePath', targetPath, nextName),
  deleteWorkspacePath: (targetPath: string) => ipcRenderer.invoke('workspace:deletePath', targetPath),

  // --- System ---
  getSystemStats: () => ipcRenderer.invoke('system:getStats'),
  getRuntimeDiagnostics: () => ipcRenderer.invoke('runtime:getDiagnostics'),
  onRuntimeDiagnostics: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('runtime:diagnostics', handler)
    return () => ipcRenderer.removeListener('runtime:diagnostics', handler)
  },

  // --- Window Controls (frameless) ---
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowRestore: () => ipcRenderer.invoke('window:restore'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onWindowStateChanged: (callback: (data: { isMaximized: boolean; isFullScreen: boolean; isResizable: boolean }) => void) => {
    const handler = (_event: any, data: { isMaximized: boolean; isFullScreen: boolean; isResizable: boolean }) => callback(data)
    ipcRenderer.on('window:stateChanged', handler)
    return () => ipcRenderer.removeListener('window:stateChanged', handler)
  },

  // --- Agent Orchestration ---
  createAgentTask: (payload: any) => ipcRenderer.invoke('agent:createTask', payload),
  listAgentTasks: () => ipcRenderer.invoke('agent:listTasks'),
  getAgentTask: (id: string) => ipcRenderer.invoke('agent:getTask', id),
  approveAgentTask: (id: string, workspaceRootPath?: string | null) => ipcRenderer.invoke('agent:approveTask', id, workspaceRootPath),
  cancelAgentTask: (id: string) => ipcRenderer.invoke('agent:cancelTask', id),
  testCreateAgentTaskFixture: (payload: any) => ipcRenderer.invoke('test:agent:createFixture', payload),
  testClearAgentTasks: () => ipcRenderer.invoke('test:agent:clear'),
  onAgentUpdate: (callback: (tasks: any[]) => void) => {
    const handler = (_event: any, tasks: any[]) => callback(tasks)
    ipcRenderer.on('agent:update', handler)
    return () => ipcRenderer.removeListener('agent:update', handler)
  },
  onAgentEvent: (callback: (event: any) => void) => {
    const handler = (_event: any, event: any) => callback(event)
    ipcRenderer.on('agent:event', handler)
    return () => ipcRenderer.removeListener('agent:event', handler)
  },

  // --- Terminal (PTY) ---
  terminalListShells: () => ipcRenderer.invoke('terminal:listShells'),
  terminalSpawn: (options: { cwd?: string; cols?: number; rows?: number; shellId?: string }) =>
    ipcRenderer.invoke('terminal:spawn', options),
  terminalWrite: (ptyId: number, data: string) =>
    ipcRenderer.invoke('terminal:write', ptyId, data),
  terminalResize: (ptyId: number, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:resize', ptyId, cols, rows),
  terminalKill: (ptyId: number) =>
    ipcRenderer.invoke('terminal:kill', ptyId),
  onTerminalData: (ptyId: number, callback: (data: string) => void) => {
    const handler = (_event: any, data: string) => callback(data)
    ipcRenderer.on(`terminal:data:${ptyId}`, handler)
    return () => ipcRenderer.removeListener(`terminal:data:${ptyId}`, handler)
  },
  onTerminalExit: (ptyId: number, callback: (data: { exitCode: number; signal?: number }) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on(`terminal:exit:${ptyId}`, handler)
    return () => ipcRenderer.removeListener(`terminal:exit:${ptyId}`, handler)
  },

  // --- Terminal Legacy ---
  terminalExecute: (command: string, cwd: string) =>
    ipcRenderer.invoke('terminal:execute', command, cwd),
  terminalGetCwd: () => ipcRenderer.invoke('terminal:getCwd'),

  // --- File Read/Write ---
  readFile: (filePath: string) => ipcRenderer.invoke('files:readFile', filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('files:writeFile', filePath, content),
  generateCode: (payload: {
    prompt: string
    context?: string
    provider?: string
    model?: string
    mode?: 'coding' | 'plan' | 'build' | 'bugfix'
  }) =>
    ipcRenderer.invoke('ai:generateCode', payload),
  generateImage: (payload: { prompt: string; provider?: string; model?: string }) =>
    ipcRenderer.invoke('ai:generateImage', payload),

  // --- Cloud Checkpoint ---
  generateCheckpoint: () => ipcRenderer.invoke('checkpoint:generate'),
})

console.log('[Preload] API exposed to Main World')
