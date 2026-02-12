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

  // --- User Files ---
  listFiles: () => ipcRenderer.invoke('files:list'),
  importFile: () => ipcRenderer.invoke('files:import'),
  deleteFile: (fileName: string) => ipcRenderer.invoke('files:delete', fileName),
  openFilesFolder: () => ipcRenderer.invoke('files:openFolder'),

  // --- Cloud Checkpoint ---
  generateCheckpoint: () => ipcRenderer.invoke('checkpoint:generate'),
})
