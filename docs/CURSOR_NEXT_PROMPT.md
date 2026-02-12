# Cursor Continuation Prompt

Use this prompt in Cursor to continue developing the AI Agent IDE after the MVP is complete.

---

## Prompt

```
You are continuing development on an Electron + React + TypeScript desktop app called "AI Agent IDE". The MVP is complete with:

- Chat UI (sidebar, message bubbles, composer, streaming responses)
- Ollama integration (GLM 4.7 Flash, 128k context with fallback)
- Local JSON persistence (conversations, messages, settings)
- Settings screen (endpoint, model, context config)
- Workspace tab placeholder

The codebase uses:
- Electron (main process with IPC)
- React 19 + TypeScript
- Vite for bundling
- No CSS framework (plain CSS dark theme)

## Next Steps — Pick ONE area to focus on:

### 1. IDE Workspace Expansion
- Replace WorkspacePane placeholder with real file tree (use Electron fs APIs)
- Add a code editor panel (Monaco Editor or CodeMirror)
- Add integrated terminal (node-pty + xterm.js)
- Wire file operations through IPC: workspace:openFolder, workspace:readFile, workspace:writeFile

### 2. UI Polish
- Add markdown rendering library (react-markdown + syntax highlighting)
- Add copy-to-clipboard on code blocks
- Add conversation search/filter in sidebar
- Add message timestamps toggle
- Add light theme support (theme toggle in settings)
- Improve responsive layout for narrow windows

### 3. Agent Orchestration
- Add system prompt configuration per conversation
- Add model switching per conversation
- Add multi-model support (configure multiple Ollama models)
- Add conversation export/import (JSON format)
- Add token usage tracking and display

### 4. Build & Distribution
- Set up electron-builder for Windows installer (.exe)
- Add auto-update via electron-updater
- Add app icon and branding
- Set up GitHub Actions CI/CD pipeline

## Architecture Notes
- Main process files: src/main/ (index.ts, ipc.ts, ollama.ts, store.ts)
- Preload bridge: src/preload/index.ts
- React app: src/renderer/ (App.tsx + components/)
- Styles: src/renderer/styles/globals.css
- All IPC channels follow chat:* and settings:* naming convention
- Data stored in Electron userData directory as JSON files

Focus on clean, minimal changes. This app should stay lightweight.
```
