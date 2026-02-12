import { contextBridge, ipcRenderer } from 'electron'

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

  // --- Settings ---
  getSettings: () => ipcRenderer.invoke('settings:get'),

  setSettings: (settings: any) =>
    ipcRenderer.invoke('settings:set', settings),

  // --- Health Check ---
  checkHealth: () => ipcRenderer.invoke('ollama:health'),
  listModels: () => ipcRenderer.invoke('ollama:listModels'),
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

  // --- Window Controls (frameless) ---
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // --- Terminal ---
  terminalExecute: (command: string, cwd: string) =>
    ipcRenderer.invoke('terminal:execute', command, cwd),
  terminalGetCwd: () => ipcRenderer.invoke('terminal:getCwd'),

  // --- File Read/Write ---
  readFile: (filePath: string) => ipcRenderer.invoke('files:readFile', filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('files:writeFile', filePath, content),
  generateCode: (payload: { prompt: string; context?: string; provider?: string; model?: string }) =>
    ipcRenderer.invoke('ai:generateCode', payload),
  generateImage: (payload: { prompt: string; provider?: string; model?: string }) =>
    ipcRenderer.invoke('ai:generateImage', payload),

  // --- Cloud Checkpoint ---
  generateCheckpoint: () => ipcRenderer.invoke('checkpoint:generate'),
})
