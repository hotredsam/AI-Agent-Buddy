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
1. **Cloud provider API integration** - Currently only Ollama works. Need to add fetch calls to OpenAI/Anthropic/Google/Groq APIs using stored keys
2. **AI auto-execution** - Use the `allowAICodeExec` permission to let AI run generated code automatically
3. **Monaco Editor** - Replace textarea with Monaco for syntax highlighting, intellisense
4. **xterm.js + node-pty** - Replace basic terminal with real PTY terminal
5. **Agent orchestration** - Use the agent configs in agents.ts for multi-step tasks
6. **Token usage tracking** - Count tokens sent/received
7. **GPU memory indicator** - Show VRAM usage
8. **Conversation export/import** - JSON export
9. **File editing from Library** - Click a library file to open in editor
10. **System prompt customization** - Per-conversation system prompts

---

*Last updated: Phase 3 completion*
