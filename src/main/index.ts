import { app, BrowserWindow } from 'electron'
import * as path from 'path'
import { registerIpcHandlers } from './ipc'

let mainWindow: BrowserWindow | null = null

const isDev = process.env.NODE_ENV === 'development'

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1a1a2e',
    show: false, // Show after ready-to-show to avoid white flash
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
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
