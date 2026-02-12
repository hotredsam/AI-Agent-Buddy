# AI Agent IDE - Progress Log

## Project
- **Name**: AI Agent IDE (AI Agent Buddy)
- **Stack**: Electron + React + TypeScript + Vite
- **Repo**: https://github.com/hotredsam/AI-Agent-Buddy.git
- **Local AI**: Ollama (GLM 4.7 Flash default)

---

## Phase 1 - Foundation (Completed)
- Electron scaffold with frameless window + custom titlebar
- React chat UI with streaming from Ollama
- Conversation CRUD (create, rename, delete, search)
- JSON file persistence (conversations, messages, settings)
- Ollama integration: streaming tokens, health check, diagnostics
- 10 theme system (Glass, Forest, Ocean, Ember, Midnight, Slate, Sand, Rose, Cyber, Classic)
- Theme-specific agent emoji per theme
- Keyboard shortcuts (Ctrl+N new chat, Ctrl+1/2/3 views, Ctrl+, settings, Ctrl+B sidebar)
- Markdown renderer (code blocks, bold, italic, blockquotes, lists)
- Code blocks with copy-to-clipboard
- Context window auto-reduce when Ollama clamps numCtx
- Toast notification system
- Live connection status indicator
- Settings info cards (Connection, Checkpoint, Diagnostics)

## Phase 2 - Files & UI Polish (Completed)
- File manager / Library (import, delete, browse folder)
- Drag-and-drop file upload (fixed contextIsolation issue with ArrayBuffer fallback)
- Collapsible sidebar with hamburger toggle
- API Keys section in Settings (OpenAI, Anthropic, Google AI, Groq)
- Password inputs with show/hide toggle for API keys
- Cloud checkpoint prompt generator

## Phase 3 - Code Editor, Terminal, AI Integration (Completed)
### Code Editor
- New `EditorPane` component with textarea-based code editing
- File open dialog (Ctrl+O) reads file from disk via IPC
- Modified indicator, language badge auto-detection (30+ languages)
- Ctrl+S save with file write permission check
- Tab key inserts 2 spaces
- Empty state with instructions
- "Open" button in toolbar

### Terminal
- New `TerminalPane` component with command execution
- IPC handler uses `child_process.spawn` with shell:true
- 30-second timeout with SIGTERM/SIGKILL fallback
- Command history with stdout/stderr display
- Exit code display for non-zero exits
- Arrow up to recall last command
- Auto-scroll to bottom
- Clear button
- CWD display in topbar

### IPC Additions
- `terminal:execute` - run shell command with timeout
- `terminal:getCwd` - get home directory
- `files:readFile` - read file as UTF-8
- `files:writeFile` - write file to disk

### Workspace Split View
- New "Code" view (Ctrl+2) with vertical split: editor top, terminal bottom
- Sidebar now has 4 nav tabs: Chat, Code, Files, Settings

### AI-to-Editor/Terminal Integration
- Code blocks in chat now show "Editor" button (sends code to editor)
- Shell/bash code blocks show "Run" button (switches to Code view)
- Auto-detect shell commands vs code based on language tag
- "Send to Editor" populates editor content and switches to Code view

### Permissions System
- New Settings card: "Permissions"
- Toggle: Terminal Access (allow running commands)
- Toggle: File Write (allow saving files)
- Toggle: AI Code Execution (allow AI auto-running code, off by default)
- Toggle switches with smooth CSS animations
- Permissions enforced in editor save handler

### Multi-Model Provider Switching
- New Settings card: "Model Provider"
- Visual grid of providers: Ollama, OpenAI, Anthropic, Google AI, Groq
- Active provider highlighted, disabled if no API key
- Click to switch provider (saves immediately)
- `activeProvider` field added to Settings
- Provider status indicators (Connected/Key set/No key)

---

## Architecture Summary

### Main Process (`src/main/`)
- `index.ts` - App lifecycle, BrowserWindow (frameless), Ollama cleanup
- `ipc.ts` - All IPC handlers (chat, settings, files, terminal, health)
- `store.ts` - JSON file persistence layer
- `ollama.ts` - Ollama HTTP API client with streaming

### Renderer (`src/renderer/`)
- `App.tsx` - Root component, state management, routing
- `components/ChatPane.tsx` - Chat messages with markdown rendering
- `components/Composer.tsx` - Message input with auto-resize
- `components/EditorPane.tsx` - Code editor with file open/save
- `components/TerminalPane.tsx` - Terminal with command execution
- `components/SettingsPane.tsx` - Settings with API keys, permissions, themes, providers
- `components/WorkspacePane.tsx` - File library with drag-drop
- `components/Sidebar.tsx` - Collapsible sidebar with nav + conversations
- `components/Titlebar.tsx` - Custom frameless titlebar
- `components/Toast.tsx` - Toast notifications
- `types.ts` - TypeScript interfaces
- `themes.ts` - 10 themes with CSS variable injection
- `agents.ts` - Agent config stubs
- `styles/globals.css` - Full design system (~2200 lines)

### Preload (`src/preload/`)
- `index.ts` - contextBridge with all electronAPI methods

---

## What's Left To Do

### Phase 4 - PRIORITY: Embed VS Code as Editor (Next Session)
**Plan: Replace textarea editor with a full VS Code instance using `@vscode/vscode-web` or embedded Code OSS.**

Approach options (pick one):
1. **Option A: `@vscode/monaco-editor` (quick win)** - `npm install monaco-editor` then use `<MonacoEditor>` React component. Gets syntax highlighting, intellisense, minimap, multi-cursor. Easiest path.
2. **Option B: Embed full VS Code via iframe** - Use `code-server` (https://github.com/coder/code-server) running locally, embed in an iframe. Gets full VS Code with extensions.
3. **Option C: Build with Theia** - Eclipse Theia is a VS Code-compatible IDE framework built for embedding. More work but most customizable.

**Recommended: Option A (Monaco) first, then upgrade to Option B later.**

Steps for Monaco integration:
1. `npm install monaco-editor @monaco-editor/react`
2. Replace `<textarea>` in `EditorPane.tsx` with `<Editor>` from `@monaco-editor/react`
3. Configure theme to match app's dark glass design (custom Monaco theme)
4. Wire up language detection, file save, AI code injection
5. Add tab support for multiple open files

### Phase 5 - Agent File Creation & Full File Management
**AI agent can create files + OneDrive-like file management in the Library.**

#### Agent File Creation
- AI agent can create new files via IPC (e.g. `files:createFile` handler)
- When agent generates code/content, it can save to a file that auto-appears in the Library
- New IPC channel: `files:createFile(fileName, content, directory?)` → creates file on disk
- Library/Files section auto-refreshes when new files are created
- Agent should be able to create files in the project workspace or a configurable output directory

#### Full File Management (OneDrive-style)
Each file in the Library/Files section should have a context menu or action buttons with:
1. **Download** - Save/export file to a user-chosen location (Save As dialog)
2. **Edit** - Open file in the code editor (EditorPane / Monaco)
3. **Delete** - Remove file from disk (with confirmation dialog)
4. **Rename** - Rename file in-place (inline rename input)
5. **Move** - Move file to a different folder (folder picker dialog)
6. **Duplicate** - Copy file with a new name (e.g. `file_copy.txt`)
7. **Copy Path** - Copy the full file path to clipboard
8. **View Details** - Show file size, created date, modified date, file type
9. **Open in Explorer** - Open containing folder in OS file explorer (`shell.showItemInFolder`)
10. **Open Externally** - Open file with the system default app (`shell.openPath`)

Implementation approach:
1. Add new IPC handlers: `files:createFile`, `files:deleteFile`, `files:renameFile`, `files:moveFile`, `files:duplicateFile`, `files:getFileInfo`, `files:showInExplorer`, `files:openExternal`
2. Update `WorkspacePane.tsx` to show action buttons/context menu per file
3. Add confirmation dialogs for destructive actions (delete)
4. Update preload bridge with new file management APIs
5. Wire agent file creation into the chat/AI response pipeline

### Other Remaining Tasks
1. **Cloud provider API integration** - Connect to OpenAI/Anthropic/Google/Groq using stored keys
2. **AI auto-execution** - Use `allowAICodeExec` permission for auto-running code
3. **xterm.js + node-pty** - Replace basic terminal with real PTY terminal
4. **Agent orchestration** - Use agent configs for multi-step tasks
5. **Token usage tracking** - Count tokens sent/received
6. **GPU memory indicator** - Show VRAM usage
7. **Conversation export/import** - JSON export
8. **System prompt customization** - Per-conversation system prompts

---

## Handoff Notes for Codex / Next Session

**Where we left off**: Phase 3 is fully complete and committed. PROGRESS.md is updated with Phase 4 (Monaco editor) and Phase 5 (Agent file creation + file management) plans.

**Next steps in priority order**:

1. **Phase 4 - Monaco Editor** (start here):
   - `npm install monaco-editor @monaco-editor/react`
   - Replace `<textarea>` in `src/renderer/components/EditorPane.tsx` with `<Editor>` from `@monaco-editor/react`
   - Create a custom dark Monaco theme that matches the app's glass design (CSS vars are in `src/renderer/styles/globals.css`, theme system in `src/renderer/themes.ts`)
   - Wire up: language auto-detection from file extension, Ctrl+S save, AI code injection (the `onSendToEditor` callback in `App.tsx` sets `editorContent`)
   - Add multi-tab support (open multiple files in tabs)
   - **Key files**: `EditorPane.tsx`, `App.tsx` (editor state + handlers), `globals.css` (styling)

2. **Phase 5 - Agent File Creation + File Management**:
   - Add IPC handlers in `src/main/ipc.ts` for createFile, deleteFile, renameFile, moveFile, duplicateFile, getFileInfo, showInExplorer, openExternal
   - Update preload in `src/preload/index.ts` with new bridge methods
   - Update types in `src/renderer/types.ts` with new ElectronAPI methods
   - Update `src/renderer/components/WorkspacePane.tsx` to show per-file action buttons or right-click context menu
   - Add a way for the AI chat responses to trigger file creation (button on code blocks: "Save as File")

**Architecture reminders**:
- All IPC goes through `contextBridge` (preload pattern). Never use `nodeIntegration: true`.
- Build: `npm run build` (runs both vite build + tsc). Dev: `npm run dev`.
- The app uses a custom frameless window with `src/renderer/components/Titlebar.tsx`.
- Settings persist as JSON via `src/main/store.ts`.
- 10 themes defined in `src/renderer/themes.ts`, CSS vars injected via `applyTheme()`.
- Main process + preload are CommonJS (`"module": "commonjs"`). Renderer is ESM.
- `strict: true` in all three tsconfigs. No implicit any.

**Comprehensive handoff file**: See `CODEX_HANDOFF.md` for complete implementation guide with code snippets, file-by-file instructions, testing checklist, and common pitfalls.

3. **Task 3 (if time) - Cloud Provider APIs**:
   - Create `src/main/openai.ts`, `anthropic.ts`, `google.ts`, `groq.ts` streaming clients
   - Update `ipc.ts` `chat:sendMessage` to route by `settings.activeProvider`
   - API keys are already stored via Settings (accessed as `settings.apiKeys.openai`, etc.)

*Last updated: Phase 3 complete, CODEX_HANDOFF.md created for Codex handoff*
