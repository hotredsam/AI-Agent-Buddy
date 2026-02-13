import { app, BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { registerIpcHandlers } from './ipc'
import { unloadModel } from './ollama'
import { getSettings } from './store'

let mainWindow: BrowserWindow | null = null

const isDev = process.env.NODE_ENV === 'development'

function createWindow(): void {
  // More robust path resolution for both dev and prod
  const preloadPath = isDev 
    ? path.join(app.getAppPath(), 'dist', 'preload', 'index.js')
    : path.join(__dirname, '..', 'preload', 'index.js')
    
  console.log('[Main] Preload path:', preloadPath)
  
  if (!fs.existsSync(preloadPath)) {
    console.error('[Main] Preload script NOT FOUND at:', preloadPath)
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0c0c14',
    show: false,
    frame: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Set to false to ensure preload initialization doesn't hit sandbox restrictions
    },
  })

  // Show window when content is ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Load the app
  if (isDev) {
    const devPort = process.env.DEV_SERVER_PORT || '5173'
    mainWindow.loadURL(`http://localhost:${devPort}`)
    // Open DevTools in development
    mainWindow.webContents.openDevTools()
  } else {
    const indexPath = path.join(__dirname, '../renderer/index.html')
    mainWindow.loadFile(indexPath)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// --- App Lifecycle ---

// Register IPC handlers before creating windows
app.on('ready', () => {
  registerIpcHandlers()
  createWindow()
})

// Unload the model from Ollama before quitting to free GPU/RAM
app.on('before-quit', async () => {
  try {
    const settings = getSettings()
    await unloadModel(settings.ollamaEndpoint, settings.modelName)
  } catch {
    // Best-effort cleanup
  }
})

app.on('window-all-closed', () => {
  // On macOS, apps typically stay active until the user quits explicitly
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS, re-create a window when the dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
