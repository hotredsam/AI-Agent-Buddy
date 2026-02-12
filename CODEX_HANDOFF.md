# Codex Handoff - AI Agent IDE (AI Agent Buddy)

> **Read this entire file before writing any code.** It contains everything you need.

---

## Quick Start

```bash
cd "C:\Users\hotre\OneDrive\Desktop\Coding Projects\AI Agent IDE"
npm run build        # vite build + tsc -p tsconfig.main.json + tsc -p tsconfig.preload.json
npm run electron     # launch the app
npm run start        # build + launch in one step
npm run dev:electron # dev mode with hot reload (runs scripts/dev.mjs)
```

**Verify your changes compile:**
```bash
npx tsc --noEmit                    # renderer type-check only
npx tsc -p tsconfig.main.json      # main process
npx tsc -p tsconfig.preload.json   # preload script
npm run build                       # full build (vite + tsc)
```

---

## Project Overview

An **Electron + React + TypeScript + Vite** desktop AI assistant IDE. It's a local ChatGPT-style app powered by **Ollama** (GLM 4.7 Flash default), with a glassmorphic Apple Vision OS design. The app has chat, a code editor, a terminal, a file library, 10 themes, and multi-model provider support.

- **Repo**: https://github.com/hotredsam/AI-Agent-Buddy.git
- **Local path**: `C:\Users\hotre\OneDrive\Desktop\Coding Projects\AI Agent IDE`
- **Node.js**: 18+ required (uses native fetch)
- **Electron**: 40.4.0
- **React**: 19.2.4

---

## Current State (Phase 3 Complete)

Everything through Phase 3 is done and committed. The app works end-to-end:
- Chat with streaming LLM responses
- Code editor (textarea-based) with file open/save
- Terminal with command execution
- File library with drag-and-drop import
- 10 themes with live switching
- Permissions system (terminal, file write, AI code exec)
- Multi-model provider UI (Ollama + OpenAI/Anthropic/Google AI/Groq)
- Settings, diagnostics, connection status, toast notifications

---

## YOUR TASKS (Priority Order)

### Task 1: Monaco Editor (Phase 4)

Replace the `<textarea>` code editor with Monaco (the VS Code editor engine).

**Steps:**
1. `npm install monaco-editor @monaco-editor/react`
2. Replace the `<textarea>` in `src/renderer/components/EditorPane.tsx` with Monaco's `<Editor>` component
3. Create a custom dark theme that matches the app's glass design (use CSS variable values from themes.ts)
4. Wire up: language auto-detection, Ctrl+S save, AI code injection via `onContentChange`
5. Add multi-tab support (open multiple files in tabs)

**Key file: `src/renderer/components/EditorPane.tsx`** (currently 164 lines)

Current EditorPane has:
- Props: `filePath`, `content`, `onContentChange`, `onSave`, `language`, `onOpenFile`
- Empty state when no file is open
- Modified indicator, language badge, Save button in topbar
- Tab key inserts 2 spaces
- Ctrl+S keyboard shortcut

Replace the `<textarea>` (line 150-161) with Monaco:
```tsx
import Editor from '@monaco-editor/react'

// Inside the component:
<Editor
  height="100%"
  language={monacoLanguage} // map from language prop
  value={content}
  onChange={(value) => onContentChange(value || '')}
  theme="ai-agent-dark" // custom theme name
  options={{
    minimap: { enabled: true },
    fontSize: 13,
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    scrollBeyondLastLine: false,
    automaticLayout: true,
    wordWrap: 'on',
    tabSize: 2,
  }}
/>
```

**Language mapping needed** (extension -> Monaco language ID):
```typescript
const MONACO_LANG_MAP: Record<string, string> = {
  'TypeScript': 'typescript', 'JavaScript': 'javascript',
  'Python': 'python', 'Rust': 'rust', 'Go': 'go',
  'Java': 'java', 'C': 'c', 'C++': 'cpp', 'C#': 'csharp',
  'Ruby': 'ruby', 'PHP': 'php', 'Swift': 'swift',
  'HTML': 'html', 'CSS': 'css', 'SCSS': 'scss',
  'JSON': 'json', 'YAML': 'yaml', 'XML': 'xml',
  'Markdown': 'markdown', 'SQL': 'sql', 'Shell': 'shell',
  'Bash': 'shell', 'PowerShell': 'powershell',
}
```

**Custom Monaco theme** (register before first use):
```typescript
import { loader } from '@monaco-editor/react'

loader.init().then(monaco => {
  monaco.editor.defineTheme('ai-agent-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#0c0c14',
      'editor.foreground': '#e8e8ec',
      'editor.lineHighlightBackground': '#1c1c2340',
      'editor.selectionBackground': '#6eaaff30',
      'editorCursor.foreground': '#6eaaff',
      'editorLineNumber.foreground': '#ffffff32',
      'editorLineNumber.activeForeground': '#ffffff55',
    }
  })
})
```

**Vite config** may need a Monaco worker plugin. Add to `vite.config.ts`:
```bash
npm install vite-plugin-monaco-editor
```
Then in vite.config.ts add the plugin. OR use `@monaco-editor/react`'s default CDN workers (simpler, works out of the box).

**Multi-tab support**: Add to `App.tsx`:
- State: `openTabs: { filePath: string; content: string; language: string }[]`
- `activeTabIndex: number`
- Tab bar above editor showing filenames, click to switch, X to close
- New CSS for `.editor-tabs`, `.editor-tab`, `.editor-tab.active`

---

### Task 2: Agent File Creation & OneDrive-style File Management (Phase 5)

**Part A: AI Agent Creates Files**

1. Add IPC handler in `src/main/ipc.ts`:
```typescript
ipcMain.handle(
  'files:createFile',
  async (_event: IpcMainInvokeEvent, fileName: string, content: string, directory?: string): Promise<store.UserFile | null> => {
    return store.createUserFile(fileName, content, directory)
  }
)
```

2. Add to `src/main/store.ts`:
```typescript
export function createUserFile(fileName: string, content: string, directory?: string): UserFile | null {
  ensureUserFilesDir()
  const dir = directory || getUserFilesDir()
  const filePath = path.join(dir, fileName)
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    const stats = fs.statSync(filePath)
    return {
      name: fileName,
      path: filePath,
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      type: path.extname(fileName).toLowerCase() || 'unknown',
    }
  } catch {
    return null
  }
}
```

3. Add to preload `src/preload/index.ts`:
```typescript
createFile: (fileName: string, content: string, directory?: string) =>
  ipcRenderer.invoke('files:createFile', fileName, content, directory),
```

4. Add to `src/renderer/types.ts` ElectronAPI interface:
```typescript
createFile: (fileName: string, content: string, directory?: string) => Promise<UserFile | null>
```

5. Add "Save as File" button to code blocks in `ChatPane.tsx` CodeBlock component (alongside existing Editor/Run/Copy buttons):
```tsx
<button className="code-block-copy" onClick={() => handleSaveAsFile(code, lang)} title="Save as File">
  {'\u{1F4BE}'} Save
</button>
```
This should prompt for a filename, call `window.electronAPI.createFile(name, code)`, and show a toast on success.

**Part B: Full File Management (OneDrive-style)**

Update `src/renderer/components/WorkspacePane.tsx` to add per-file action menu. Currently each file only has a delete button (line 128-134). Add a dropdown/context menu with:

1. **Download** (Save As) - New IPC handler:
```typescript
// ipc.ts
ipcMain.handle('files:saveAs', async (_event, sourcePath: string) => {
  const result = await dialog.showSaveDialog({ defaultPath: path.basename(sourcePath) })
  if (!result.canceled && result.filePath) {
    fs.copyFileSync(sourcePath, result.filePath)
    return true
  }
  return false
})
```

2. **Edit** - Open in editor:
```typescript
// WorkspacePane needs onOpenInEditor prop from App.tsx
onOpenInEditor={(file) => {
  const content = await window.electronAPI.readFile(file.path)
  setEditorFilePath(file.path)
  setEditorContent(content)
  setEditorLanguage(detectLanguage(file.path))
  setView('code')
}}
```

3. **Delete** - Already exists, but add confirmation dialog:
```tsx
if (confirm(`Delete "${file.name}"? This cannot be undone.`)) {
  await handleDelete(file.name)
}
```

4. **Rename** - New IPC handler:
```typescript
// ipc.ts
ipcMain.handle('files:renameFile', async (_event, oldName: string, newName: string) => {
  return store.renameUserFile(oldName, newName)
})

// store.ts
export function renameUserFile(oldName: string, newName: string): UserFile | null {
  ensureUserFilesDir()
  const oldPath = path.join(getUserFilesDir(), oldName)
  const newPath = path.join(getUserFilesDir(), newName)
  if (!oldPath.startsWith(getUserFilesDir())) return null
  try {
    fs.renameSync(oldPath, newPath)
    const stats = fs.statSync(newPath)
    return { name: newName, path: newPath, size: stats.size, modifiedAt: stats.mtime.toISOString(), type: path.extname(newName).toLowerCase() || 'unknown' }
  } catch { return null }
}
```

5. **Move** - Folder picker + fs.renameSync to new location
6. **Duplicate** - Copy file with `_copy` suffix
7. **Copy Path** - `navigator.clipboard.writeText(file.path)`
8. **View Details** - Modal/tooltip showing size, dates, type
9. **Open in Explorer** - `shell.showItemInFolder(file.path)` (IPC handler already partially exists as `files:openFolder`)
10. **Open Externally** - `shell.openPath(file.path)`

New IPC handlers needed in `ipc.ts`:
```typescript
ipcMain.handle('files:createFile', ...)
ipcMain.handle('files:saveAs', ...)
ipcMain.handle('files:renameFile', ...)
ipcMain.handle('files:moveFile', ...)
ipcMain.handle('files:duplicateFile', ...)
ipcMain.handle('files:getFileInfo', ...)
ipcMain.handle('files:showInExplorer', ...)
ipcMain.handle('files:openExternal', ...)
```

Each needs a matching preload bridge method and ElectronAPI type.

**UI for file actions**: Add a `...` menu button or right-click context menu per file item in WorkspacePane. CSS class `.file-action-menu` with dropdown positioning.

---

### Task 3: Cloud Provider API Integration

Currently the app only talks to Ollama. The `activeProvider` field in settings lets users select OpenAI/Anthropic/Google/Groq, but the backend doesn't actually call those APIs yet.

**Approach**: Create provider-specific streaming functions in `src/main/` similar to `ollama.ts`:

1. `src/main/openai.ts` - OpenAI Chat Completions API with streaming
2. `src/main/anthropic.ts` - Anthropic Messages API with streaming
3. `src/main/google.ts` - Google Gemini API with streaming
4. `src/main/groq.ts` - Groq API (OpenAI-compatible) with streaming

Then update `ipc.ts` `chat:sendMessage` handler to check `settings.activeProvider` and route to the correct API.

**Example OpenAI integration:**
```typescript
export async function* sendOpenAIStream(apiKey: string, model: string, messages: ChatMessage[]): AsyncGenerator<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: true }),
  })
  // Parse SSE stream...
}
```

---

### Task 4: Other Improvements (if time permits)

1. **xterm.js + node-pty** - Replace the basic terminal with a real PTY:
   - `npm install xterm xterm-addon-fit node-pty`
   - Replace TerminalPane's spawn-based execution with persistent PTY shell
   - Note: `node-pty` needs native compilation (`electron-rebuild`)

2. **System prompt customization** - Per-conversation system prompts stored in conversation metadata

3. **Token usage tracking** - Count tokens in Ollama responses (eval_count from stream chunks)

4. **Conversation export/import** - JSON export of full conversation history

---

## Architecture Reference

### Directory Structure
```
src/
  main/           # Electron main process (Node.js)
    index.ts      # App lifecycle, BrowserWindow, Ollama cleanup on quit
    ipc.ts        # ALL IPC handlers (conversations, messages, settings, files, terminal)
    ollama.ts     # Ollama HTTP client: streaming, health check, diagnostics, unload
    store.ts      # JSON file persistence: conversations, messages, settings, user files
  preload/
    index.ts      # contextBridge exposing electronAPI to renderer
  renderer/       # React frontend (bundled by Vite)
    main.tsx      # React entry point
    App.tsx       # Root component: state management, routing, handlers
    types.ts      # TypeScript interfaces (Conversation, Message, Settings, ElectronAPI)
    themes.ts     # 10 themes with CSS variable injection
    agents.ts     # Agent config stubs (local-coder, cloud-reasoner, qa-agent)
    components/
      ChatPane.tsx      # Chat messages with markdown rendering, code block actions
      Composer.tsx      # Message input with auto-resize
      Sidebar.tsx       # Collapsible sidebar with nav + conversation list
      EditorPane.tsx    # Code editor (textarea - REPLACE WITH MONACO)
      TerminalPane.tsx  # Terminal with command execution
      WorkspacePane.tsx # File library with drag-drop (ADD FILE MANAGEMENT HERE)
      SettingsPane.tsx  # Settings: connection, API keys, themes, permissions, providers
      Titlebar.tsx      # Custom frameless window titlebar
      Toast.tsx         # Toast notification system
    styles/
      globals.css       # Full design system (~2200 lines)
```

### IPC Architecture

**CRITICAL PATTERN**: All communication between renderer and main process goes through contextBridge. Never use `nodeIntegration: true`.

Flow: `Renderer (React) -> window.electronAPI.method() -> preload (ipcRenderer.invoke) -> main (ipcMain.handle) -> store/ollama/fs`

When adding a new feature:
1. Add IPC handler in `src/main/ipc.ts`
2. Add bridge method in `src/preload/index.ts`
3. Add type to ElectronAPI interface in `src/renderer/types.ts`
4. Call from React component via `window.electronAPI.newMethod()`

### Data Storage

All app data lives in Electron's `userData` directory:
- `app-data/conversations.json` - Conversation metadata
- `app-data/messages/{id}.json` - Messages per conversation
- `app-data/settings.json` - App settings
- `user-files/` - Imported/created files (the Library)

### Streaming Architecture

Chat messages stream from Ollama via:
1. Main process calls `sendMessageStream()` (async generator in ollama.ts)
2. Each token is sent to renderer via `event.sender.send('chat:token', {...})`
3. Renderer subscribes via `window.electronAPI.onToken(callback)`
4. `chat:done` fires when stream completes, `chat:error` on failure
5. `chat:contextInfo` reports effective context window size

### Theme System

10 themes defined in `themes.ts`. Each theme has ~25 CSS variable tokens. `applyTheme()` sets CSS custom properties on `document.documentElement.style`. All components use `var(--variable-name)` in CSS.

Theme names: glass, forest, ocean, ember, midnight, slate, sand, rose, cyber, classic.

### Key CSS Classes

- `.app-root` - Full viewport container
- `.app-layout` - Flexbox row (sidebar + main)
- `.main-content` - Right side content area
- `.workspace-split` - Vertical split (editor top, terminal bottom)
- `.glass-*` - Glass morphism backgrounds
- `.settings-card` - Settings section container
- `.code-block-wrapper` - Fenced code block in chat

### Build System

- **Renderer**: Vite bundles React to `dist/renderer/`
- **Main process**: `tsc -p tsconfig.main.json` compiles to `dist/main/`
- **Preload**: `tsc -p tsconfig.preload.json` compiles to `dist/preload/`
- All three must compile for the app to work

---

## Files You Will Modify

### Definitely modify:
- `src/renderer/components/EditorPane.tsx` - Replace textarea with Monaco
- `src/renderer/components/WorkspacePane.tsx` - Add file management actions
- `src/renderer/components/ChatPane.tsx` - Add "Save as File" button on code blocks
- `src/main/ipc.ts` - Add new IPC handlers (createFile, renameFile, saveAs, etc.)
- `src/main/store.ts` - Add new store functions (createUserFile, renameUserFile, etc.)
- `src/preload/index.ts` - Add new bridge methods
- `src/renderer/types.ts` - Add new ElectronAPI methods
- `src/renderer/styles/globals.css` - Add CSS for Monaco, file menus, tabs
- `src/renderer/App.tsx` - Add multi-tab state, wire up file management callbacks
- `package.json` - Add monaco-editor, @monaco-editor/react dependencies

### Possibly create:
- `src/main/openai.ts` - OpenAI streaming client
- `src/main/anthropic.ts` - Anthropic streaming client
- `src/main/google.ts` - Google AI streaming client
- `src/main/groq.ts` - Groq streaming client

### Possibly modify:
- `vite.config.ts` - Monaco worker plugin if CDN doesn't work
- `src/renderer/themes.ts` - Add Monaco theme generation from app themes

---

## Common Pitfalls

1. **contextIsolation**: You CANNOT access Node.js APIs from the renderer. Everything goes through preload bridge.
2. **TypeScript strict mode**: All three tsconfig files have `strict: true`. No implicit any.
3. **Main process is CommonJS**: `tsconfig.main.json` uses `"module": "commonjs"`. Don't use ESM imports in main process files.
4. **Preload is CommonJS too**: Same as main.
5. **Renderer is ESM**: `tsconfig.json` uses `"module": "ESNext"` and `"moduleResolution": "bundler"`.
6. **Build order matters**: Vite builds renderer, then tsc builds main + preload separately.
7. **Ollama must be running**: The app expects Ollama at `http://127.0.0.1:11434`. It gracefully handles connection failures.
8. **CSS variables**: Always use `var(--name)` in CSS, never hardcode colors. The theme system depends on this.
9. **Window is frameless**: `frame: false` in BrowserWindow config. Custom titlebar at top.
10. **sandbox: false**: Required for `child_process.spawn` in preload context (terminal).

---

## Git Workflow

```bash
git add <specific-files>
git commit -m "Phase 4: Monaco editor integration

- Replaced textarea with Monaco editor
- Custom dark theme matching glass design
- Multi-tab file support
- Language auto-detection

Co-Authored-By: Codex <noreply@openai.com>"
git push origin main
```

---

## Testing Checklist

After making changes, verify:
- [ ] `npm run build` succeeds with no errors
- [ ] App launches with `npm run electron`
- [ ] Chat works (send message, get streaming response)
- [ ] Code editor opens files and saves them
- [ ] Terminal executes commands
- [ ] File library shows files, import works, drag-drop works
- [ ] All 10 themes apply correctly
- [ ] Settings save and persist across restarts
- [ ] Keyboard shortcuts work (Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+1/2/3, Ctrl+B, Ctrl+,)

---

*Generated by Claude. Good luck Codex! The owner is sleeping - ship it clean.*
