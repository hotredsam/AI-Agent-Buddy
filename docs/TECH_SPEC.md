# Technical Specification

## 1. Architecture Overview

**Stack**: Electron 33.4.0 + React 19 + TypeScript 5.9 + Vite 7.3

The application follows a three-process Electron architecture:
- **Main process** (`src/main/`): Node.js runtime handling IPC, AI providers, file system, terminal PTY, job queue, and agent orchestration.
- **Preload** (`src/preload/index.ts`): Context bridge exposing `window.electronAPI` to the renderer. `contextIsolation: true`, `nodeIntegration: false`.
- **Renderer** (`src/renderer/`): React SPA bundled by Vite. Communicates exclusively through the preload bridge.

### IPC Flow
```
Renderer (React) -> window.electronAPI.method()
  -> preload (ipcRenderer.invoke)
  -> main (ipcMain.handle)
  -> store / provider / fs / pty
```

All IPC sends to the renderer are guarded by `safeRendererSend()` to prevent crashes when windows are destroyed.

---

## 2. AI Provider Architecture

Six providers, each with a dedicated streaming module in `src/main/`:

| Provider | Module | Protocol | Endpoint |
|----------|--------|----------|----------|
| Ollama | `ollama.ts` | Native Ollama API (`/api/chat`) | `http://127.0.0.1:11434` |
| llama.cpp | `llamacpp.ts` | OpenAI-compatible (`/v1/chat/completions`) | `http://127.0.0.1:8080` |
| OpenAI | `openai.ts` | OpenAI Chat Completions API | `https://api.openai.com/v1` |
| Anthropic | `anthropic.ts` | Anthropic Messages API | `https://api.anthropic.com/v1` |
| Google | `google.ts` | Google Gemini API | `https://generativelanguage.googleapis.com` |
| Groq | `groq.ts` | OpenAI-compatible | `https://api.groq.com/openai/v1` |

Ollama also handles image generation in addition to chat.

### Provider Selection
- `activeProvider` setting controls the chat provider.
- `codingProvider` setting controls the code generation provider.
- `imageProvider` setting controls image generation.
- All three can be set independently to different providers.
- The `ipc.ts` `chat:sendMessage` handler reads the active provider and routes to the correct streaming function.

### Streaming Pattern
All providers implement the async generator pattern:
```typescript
async function* sendStream(...): AsyncGenerator<string, void, unknown> {
  // ... yield tokens one at a time
}
```
Tokens are forwarded to the renderer via `event.sender.send('chat:token', { conversationId, token })`.

---

## 3. llama.cpp Integration

### Module: `src/main/llamacpp.ts`

Communicates with `llama-server` via its OpenAI-compatible REST API.

**Functions**:
- `sendLlamaCppStream(endpoint, model, messages, abortSignal)` - Streaming chat completions via SSE.
- `checkLlamaCppHealth(endpoint)` - GET `/health` with 5s timeout.
- `listLlamaCppModels(endpoint)` - GET `/v1/models` to enumerate loaded models.

**Default Configuration**:
- Server endpoint: `http://127.0.0.1:8080`
- Target model: Qwen3 Coder 30B (Instruct, Q4_K_M GGUF)

**Settings UI** (in `SettingsPane.tsx`):
- Endpoint URL input
- Model name input
- Binary path input
- Model file path input
- Health check button (calls `checkLlamaCppHealth`)
- Launch server button (calls `launchLlamaCpp` IPC)

**Timeout**: 600s (10 minutes) for streaming requests, combined with optional caller-provided AbortSignal via `AbortSignal.any()`.

---

## 4. File System & Sandboxing

### Library Root
All user data lives under Electron's `userData` directory:
- `app-data/conversations.json` - Conversation metadata
- `app-data/messages/{id}.json` - Messages per conversation
- `app-data/settings.json` - App settings
- `app-data/session-state.json` - Session persistence (view, sidebar, workspace root)
- `user-files/` - File library root
- `user-files/projects/` - Projects container

### Path Safety
- `isInsideDir()` checks ensure resolved paths stay within allowed directories.
- `sanitizeLeafName()` normalizes filenames to prevent path traversal.
- `createUserFile` and `createUserProject` resolve paths strictly relative to `getUserFilesDir()`.
- Agent file writes are restricted to `workspaceRootPath` via normalized path checks in `agent-runner.ts`.

### File Operations (IPC)
Full CRUD: `createFile`, `createProject`, `renameFile`, `moveFile`, `duplicateFile`, `deleteFile`, `saveAs`, `getFileInfo`, `showInExplorer`, `openExternal`.

Workspace operations: `pickWorkspaceFolder`, `pickWorkspaceFile`, `listWorkspaceFolder`, `createWorkspaceFile`, `createWorkspaceFolder`, `renameWorkspacePath`, `deleteWorkspacePath`.

---

## 5. Agent Task System

### State Machine
```
Idle -> Planning -> WaitingApproval -> Building -> Testing -> Done
                                    \                      \-> Error
                                     \-> Cancelled
```

### Modes
- `plan` - Generates a structured plan with steps; requires approval.
- `build` - Executes the plan; creates/edits files in workspace.
- `coding` - Direct code generation (no plan phase).
- `bugfix` - Targeted bug fix mode.

### Multi-File Actions
`parseBatchActions()` in `agent-runner.ts` parses AI responses into batch file operations, enabling the agent to create or modify multiple files in a single step.

### Events (IPC)
- `agent:update` - Full task snapshot broadcast (all active tasks).
- `agent:event` - Granular event stream with types: `task_created`, `planning_started`, `plan_generated`, `waiting_approval`, `approved`, `build_started`, `step_started`, `step_completed`, `file_written`, `testing_started`, `test_command_start`, `test_output`, `test_command_complete`, `task_completed`, `task_failed`, `task_cancelled`, `contract_violation`, `log`.

### Safety Constraints (configurable via `agentSafety` settings)
- `maxActions`, `maxFileWrites`, `maxCommands`, `maxBytesWritten`
- `maxContractViolations`, `maxCommandTimeoutMs`, `commandKillGraceMs`
- `maxViolationRetriesPerStep`

### Testing Phase
Runs in order, stopping on first failure:
1. `npm run build`
2. `npx tsc --noEmit`
3. `npm test` (only when `package.json` has a `test` script)

---

## 6. Monaco Editor

### Integration
- Package: `@monaco-editor/react` (v4.7.0) + `monaco-editor` (v0.55.1)
- Component: `EditorPane.tsx`
- Custom dark theme (`ai-agent-dark`) matching glassmorphic design.
- Multi-tab editing with tab management.

### AI Hooks
- **Insert at cursor**: AI-generated code can be injected at the current cursor position.
- **Replace file**: Full file replacement from AI output.
- **Diff/patch detection**: AI responses containing diffs or patches are detected via `patchApply.ts` and can be applied to the editor.

### Command Palette
- Triggered by `Ctrl+P`.
- Fuzzy file search across workspace.
- Component: `CommandPalette.tsx`.

### Multi-file Context
- All open tabs are included as context when sending AI requests.
- Context is assembled from the `openTabs` state in `App.tsx`.

---

## 7. Terminal

### Stack
- `node-pty` (v1.1.0) for PTY spawning in main process.
- `xterm.js` (v5.3.0) + `xterm-addon-fit` for terminal rendering.

### Shell Discovery
On startup, scans for available shells:
- PowerShell: `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`
- CMD: `C:\Windows\System32\cmd.exe`
- Git Bash: `C:\Program Files\Git\bin\bash.exe`
- WSL: `C:\Windows\System32\wsl.exe`

### Features
- Multi-terminal tabs with add/close actions.
- Shell selector dropdown per terminal.
- Split mode for side-by-side terminals.
- PTY sessions auto-killed when renderer window is destroyed.
- IPC: `terminalSpawn`, `terminalWrite`, `terminalResize`, `terminalKill`, `onTerminalData`, `onTerminalExit`.

---

## 8. Runtime Diagnostics

### Module: `src/main/runtime-diagnostics.ts`

Tracks:
- Active request count and active model list.
- Per-request metadata (provider, model, kind, phase, timing).
- Recent request history with outcomes.
- Image model loaded state and last unload timestamp.

### Broadcast
- Channel: `runtime:diagnostics`
- Renderer subscribes via `onRuntimeDiagnostics(callback)`.
- Displayed in AI Pane diagnostics section.

### Ollama Protections
- Blocks concurrent Ollama inferences to prevent duplicate model loads (concurrency protection).
- Unloads prior tracked model when switching models.
- Active request monitoring to avoid resource contention.

---

## 9. Theme System

13 themes defined in `src/renderer/themes.ts`:

**Dark themes** (10): glass, forest, ocean, ember, midnight, slate, sand, rose, cyber, classic.

**Light themes** (3): light, light-ocean, light-rose.

Each theme provides ~30 CSS variable tokens covering glass backgrounds, borders, accent colors, text colors, status colors, and ambient gradients. `applyTheme()` sets custom properties on `document.documentElement.style`. All components use `var(--variable-name)` exclusively -- no hardcoded colors.

Light themes receive `color-scheme: light` for native control styling and a `theme-light` body class.

---

## 10. Session Persistence

View state, sidebar collapsed state, and workspace root path are stored in `app-data/session-state.json` and restored on application launch.

Managed through the `store.ts` module alongside conversations, messages, and settings.

---

## 11. Keyboard Shortcuts

### Module: `src/renderer/shortcuts.ts`

`KeyboardShortcutManager` is a singleton class that:
- Maintains a registry of shortcut-to-action mappings.
- Handles keyboard events globally via `window.addEventListener('keydown', ...)`.
- Supports modifier + combo keys with normalization (e.g., `Shift+Ctrl+P` equals `Ctrl+Shift+P`).
- Avoids overriding Monaco editor shortcuts when focus is inside the editor.

### 13 Default Shortcuts (registered in `App.tsx`)

| Shortcut | Action |
|----------|--------|
| `Ctrl+1` | Switch to Chat View |
| `Ctrl+2` | Switch to Code View |
| `Ctrl+3` | Switch to Agents View |
| `Ctrl+B` | Toggle Sidebar |
| `Ctrl+N` | New Conversation |
| `Ctrl+L` | Focus Chat Input |
| `Ctrl+E` | Toggle File Explorer |
| `Ctrl+,` | Open Settings |
| `Ctrl+O` | Open File |
| `Ctrl+P` | Quick Open (Command Palette) |
| `` Ctrl+` `` | Toggle Terminal |
| `Ctrl+Shift+T` | Cycle Theme |
| `Ctrl+Shift+P` | Command Palette |

---

## 12. Error Boundaries

`src/renderer/components/ErrorBoundary.tsx` wraps all major views with crash recovery UI. When a React rendering error is caught, the boundary displays a fallback interface allowing users to recover without a full application restart.

---

## 13. Job Queue (SQLite)

### Stack
- `better-sqlite3` (v12.6.2) for synchronous SQLite access.
- Database file: `jobqueue.sqlite` in project root.

### Current State
- `src/main/jobs/JobQueue.ts` - Queue service with basic CRUD.
- `src/main/jobs/runner.ts` - Job runner/worker.
- `vitest.main.config.ts` - Vitest configuration for main-process tests.
- Tests: `jobQueue.generated.test.ts`, `smoke.test.ts`.

### Pending
- Worker with handler registry, retry/backoff, cancellation.
- IPC contract for renderer.
- Jobs panel UI.

---

## 14. Store

### Module: `src/main/store.ts`

JSON file persistence layer managing:
- Conversations and messages
- Application settings
- User files metadata
- Session state

Uses `crypto.randomUUID()` for ID generation (not the `uuid` npm package).

All data is stored as JSON files under Electron's `userData` directory.

---

## 15. Build System

- **Renderer**: `vite build` bundles React to `dist/renderer/`.
- **Main process**: `tsc -p tsconfig.main.json` compiles to `dist/main/`.
- **Preload**: `tsc -p tsconfig.preload.json` compiles to `dist/preload/`.
- **Combined**: `npm run build` runs all three (`vite build && tsc -p tsconfig.main.json && tsc -p tsconfig.preload.json`).
- **Dev mode**: `npm run dev:electron` runs `scripts/dev.mjs` with hot reload.
- **E2E tests**: `npm run test:e2e` runs Playwright (28+ tests in `tests/app.spec.ts`).
- **Unit tests**: `npx vitest run -c vitest.main.config.ts` for main-process tests.

### TypeScript Configuration
- All three tsconfig files use `strict: true`.
- Main process and preload: CommonJS module system.
- Renderer: ESNext modules with bundler resolution (Vite).

---

## 16. Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `electron` | 33.4.0 | Desktop application framework |
| `react` | 19.2.4 | UI library |
| `react-dom` | 19.2.4 | React DOM renderer |
| `@monaco-editor/react` | 4.7.0 | Code editor integration |
| `monaco-editor` | 0.55.1 | Code editor engine |
| `node-pty` | 1.1.0 | PTY spawning for terminal |
| `xterm` | 5.3.0 | Terminal emulator for renderer |
| `xterm-addon-fit` | 0.8.0 | Auto-fit addon for xterm |
| `better-sqlite3` | 12.6.2 | SQLite database driver |
| `typescript` | 5.9.3 | Type system and compiler |
| `vite` | 7.3.1 | Build tool and dev server |
| `@vitejs/plugin-react` | 5.1.4 | React support for Vite |
| `@playwright/test` | 1.58.2 | End-to-end testing framework |
| `vitest` | 4.0.18 | Unit testing framework |
| `electron-builder` | 26.7.0 | Packaging and distribution |
