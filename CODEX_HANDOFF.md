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

**Run tests:**
```bash
npx vitest run -c vitest.main.config.ts  # main-process unit tests
npx playwright test tests/app.spec.ts     # E2E smoke tests (Playwright)
```

---

## Project Overview

An **Electron + React + TypeScript + Vite** desktop AI IDE. Local-first architecture powered by **6 AI providers** (Ollama, llama.cpp, OpenAI, Anthropic, Google Gemini, Groq), with a glassmorphic Apple Vision OS-inspired design. The app features a Monaco code editor, real PTY terminal, file library, agent task system, and SQLite-backed job queue.

- **Repo**: https://github.com/hotredsam/AI-Agent-Buddy.git
- **Local path**: `C:\Users\hotre\OneDrive\Desktop\Coding Projects\AI Agent IDE`
- **Node.js**: 18+ required (uses native fetch)
- **Electron**: 40.4.0
- **React**: 19.2.4
- **TypeScript**: 5.9.3
- **Vite**: 7.3.1

---

## Current State (Phases 1-7 Complete)

The app is fully functional end-to-end:

### AI Providers (6 total)
- **Ollama** (`src/main/ollama.ts`) - Local inference via native Ollama API at `127.0.0.1:11434`. Default provider. Streaming, health check, model listing, image generation.
- **llama.cpp** (`src/main/llamacpp.ts`) - Local inference via OpenAI-compatible API at `127.0.0.1:8080`. Targets Qwen3 Coder 30B (Q4_K_M). Settings UI with endpoint, binary path, model path, health check, launch button.
- **OpenAI** (`src/main/openai.ts`) - Cloud streaming via Chat Completions API.
- **Anthropic** (`src/main/anthropic.ts`) - Cloud streaming via Messages API.
- **Google** (`src/main/google.ts`) - Cloud streaming via Gemini API.
- **Groq** (`src/main/groq.ts`) - Cloud streaming via OpenAI-compatible API.

### Code Editor
- Monaco editor (`@monaco-editor/react` v4.7.0) with custom `ai-agent-dark` theme.
- Multi-tab file support with language auto-detection.
- AI injection hooks: insert at cursor, replace file content.
- Diff/patch detection from AI responses.
- Command palette (`Ctrl+P`) with fuzzy file search (`CommandPalette.tsx`).
- Multi-file context: all open tabs included as AI context.

### AI Pane (Code View)
- Right-side collapsible AI pane (`AIPane.tsx`).
- Mode selector: Plan / Build / Code / Bug Fix.
- Provider selector: all 6 providers.
- Auto-run pipeline toggle.
- Task card with steps, approve/cancel, file-write diffs, live logs, runtime diagnostics.

### Agent Task System
- State machine: Planning -> WaitingApproval -> Building -> Testing -> Done.
- Modes: plan, build, coding, bugfix.
- Safety constraints: maxActions, maxFileWrites, maxCommands, maxBytesWritten, etc.
- Workspace write enforcement (restricted to `workspaceRootPath`).
- Testing phase: `npm run build`, `npx tsc --noEmit`, `npm test`.
- Structured IPC events: `agent:update` (snapshots), `agent:event` (granular).

### Terminal
- Real PTY via node-pty (v1.1.0) + xterm.js (v5.3.0).
- Shell discovery: PowerShell, CMD, Git Bash, WSL.
- Multi-terminal tabs, shell selector per tab, basic split mode.
- PTY sessions auto-killed on window destroy.

### File Library
- Full CRUD: create, rename, move, duplicate, delete, save-as.
- Project creation under `user-files/projects/` with `PROJECT.md` scaffold.
- Right-click context menu, drag-drop file move, sort dropdown.

### Other
- 10 glassmorphic themes (glass, forest, ocean, ember, midnight, slate, sand, rose, cyber, classic).
- Permissions system (terminal, file write, AI code exec).
- Runtime diagnostics (active requests, model tracking, Ollama concurrency protection).
- SQLite-backed job queue (basic CRUD + runner in `src/main/jobs/`).
- Customizable system prompts per mode.
- Request lifecycle states (Thinking -> Writing -> Done/Error).
- `<think>` tag parsing as collapsible Reasoning blocks.
- Chat cancellation via `chat:cancel` IPC with AbortController.

---

## YOUR TASKS (Priority Order)

### Task 1: Security Hardening (Phase 9) -- HIGHEST PRIORITY

**1a. IPC Input Validation**
- Add schema validation at the `ipcMain.handle` boundary in `src/main/ipc.ts`.
- Validate argument types, string lengths, path formats, enum values.
- Reject malformed payloads with descriptive errors.

**1b. File Safety Audit**
- Audit all file operations in `src/main/store.ts` and `src/main/agent-runner.ts` for path traversal.
- Ensure workspace paths resolve within expected roots.
- Add blocklist for sensitive file patterns (`.env`, credentials) in agent writes.

**1c. API Key Encryption**
- Current state: API keys stored as plaintext in `settings.json`.
- Migrate to Electron `safeStorage` API for encryption at rest.
- Encrypt on write, decrypt on read. Handle OS keychain unavailability with fallback + warning.
- Key files: `src/main/store.ts`

**1d. Terminal Command Safety**
- Add command blocklist for agent-controlled terminal sessions.
- Add per-session resource limits (max output buffer, execution timeout).
- Key files: `src/main/agent-runner.ts`

### Task 2: Provider Routing Intelligence (Phase 10)

- Cost-aware provider selection (local for simple tasks, cloud for complex reasoning).
- Fallback chains: Ollama -> llama.cpp -> cloud provider.
- Provider health monitoring with automatic failover.
- Per-task provider routing (plan with cloud, build with local).

### Task 3: Context & Token Intelligence (Phase 11)

- Token usage tracking per request and conversation.
- Context window utilization display in AI Pane.
- Automatic context reduction near limits.
- Cost estimation for cloud providers.

### Task 4: Job Queue Expansion (Parallel Track)

- Worker with handler registry, retry/backoff, cancellation.
- IPC contract for renderer (list, create, cancel, logs, subscribe).
- Jobs panel UI.
- Real job handlers: indexFiles, generateTests, agentTaskRun.

---

## Architecture Reference

### Directory Structure
```
src/
  main/              # Electron main process (Node.js)
    index.ts         # App lifecycle, BrowserWindow config
    ipc.ts           # ALL IPC handlers (chat, files, terminal, agent, settings, diagnostics)
    ollama.ts        # Ollama HTTP client
    llamacpp.ts      # llama.cpp client (OpenAI-compatible)
    openai.ts        # OpenAI streaming client
    anthropic.ts     # Anthropic streaming client
    google.ts        # Google Gemini streaming client
    groq.ts          # Groq streaming client
    agent-runner.ts  # Agent task orchestration
    store.ts         # JSON file persistence
    runtime-diagnostics.ts  # Request tracking and diagnostics
    jobs/
      JobQueue.ts    # SQLite-backed job queue
      runner.ts      # Job runner
    db/              # Database utilities
  preload/
    index.ts         # contextBridge exposing electronAPI
  renderer/          # React frontend (Vite)
    main.tsx         # React entry point
    App.tsx          # Root component
    types.ts         # All TypeScript interfaces + ElectronAPI
    themes.ts        # 10 themes with CSS variable injection
    agents.ts        # Agent config stubs
    components/
      AIPane.tsx          # Right-side AI pane (Code view)
      ChatPane.tsx        # Chat with markdown, code blocks, reasoning
      CodeMenuBar.tsx     # Code view top menu
      CommandPalette.tsx  # Ctrl+P fuzzy file search
      Composer.tsx        # Message input
      EditorPane.tsx      # Monaco code editor
      FileExplorerPane.tsx # File explorer tree
      SettingsPane.tsx    # All settings
      Sidebar.tsx         # Vertical nav + conversation list
      TerminalPane.tsx    # xterm.js terminal
      Titlebar.tsx        # Frameless window titlebar
      Toast.tsx           # Toast notifications
      WorkspacePane.tsx   # File library + project management
    styles/
      globals.css         # Full design system (~2200+ lines)
tests/
  app.spec.ts        # Playwright E2E tests
```

### IPC Architecture

**Pattern**: All communication between renderer and main process goes through contextBridge. `nodeIntegration: false`, `contextIsolation: true`.

```
Renderer (React) -> window.electronAPI.method()
  -> preload (ipcRenderer.invoke)
  -> main (ipcMain.handle)
  -> store / provider / fs / pty
```

All `webContents.send` calls are guarded by `safeRendererSend()`.

When adding a new feature:
1. Add IPC handler in `src/main/ipc.ts`
2. Add bridge method in `src/preload/index.ts`
3. Add type to ElectronAPI interface in `src/renderer/types.ts`
4. Call from React component via `window.electronAPI.newMethod()`

### IPC Channel Namespaces
- `chat:*` - Conversations, messages, streaming, cancellation
- `files:*` - File CRUD, project creation, workspace operations
- `terminal:*` - PTY spawn, write, resize, kill, shell listing
- `agent:*` - Task CRUD, approval, cancellation, events
- `settings:*` - Get/set settings
- `ollama:*` - Health check, model listing, image models, diagnostics
- `llamacpp:*` - Health check, model listing, server launch
- `runtime:*` - Diagnostics broadcast
- `window:*` - Minimize, maximize, restore, close, state changes

### Data Storage

All app data lives in Electron's `userData` directory:
- `app-data/conversations.json` - Conversation metadata
- `app-data/messages/{id}.json` - Messages per conversation
- `app-data/settings.json` - App settings (API keys in plaintext -- needs encryption)
- `user-files/` - File library root
- `user-files/projects/` - Projects container
- `jobqueue.sqlite` - SQLite job queue database (project root)

### Streaming Architecture

Chat messages stream from providers via async generators:
1. Main process calls provider-specific `send*Stream()` function
2. Each token is sent to renderer via `safeRendererSend('chat:token', {...})`
3. Renderer subscribes via `window.electronAPI.onToken(callback)`
4. `chat:done` fires on completion, `chat:error` on failure
5. `chat:contextInfo` reports effective context window size
6. Cancellation via `chat:cancel` IPC with AbortController

### Theme System

10 themes in `themes.ts`: glass, forest, ocean, ember, midnight, slate, sand, rose, cyber, classic. Each theme defines ~25 CSS variable tokens. `applyTheme()` sets custom properties on `document.documentElement.style`. All components use `var(--variable-name)`.

### Build System

- **Renderer**: Vite bundles React to `dist/renderer/`
- **Main process**: `tsc -p tsconfig.main.json` compiles to `dist/main/`
- **Preload**: `tsc -p tsconfig.preload.json` compiles to `dist/preload/`
- All three must compile for the app to work

---

## Common Pitfalls

1. **contextIsolation**: You CANNOT access Node.js APIs from the renderer. Everything goes through preload bridge.
2. **TypeScript strict mode**: All three tsconfig files have `strict: true`. No implicit any.
3. **Main process is CommonJS**: `tsconfig.main.json` uses `"module": "commonjs"`. Don't use ESM imports in main process files.
4. **Preload is CommonJS too**: Same as main.
5. **Renderer is ESM**: `tsconfig.json` uses `"module": "ESNext"` and `"moduleResolution": "bundler"`.
6. **Build order matters**: Vite builds renderer, then tsc builds main + preload separately.
7. **Ollama must be running**: Default provider expects Ollama at `http://127.0.0.1:11434`. Gracefully handles connection failures.
8. **llama.cpp server**: Separate local provider at `http://127.0.0.1:8080`. Must be launched manually or via the Settings UI launch button.
9. **CSS variables**: Always use `var(--name)` in CSS, never hardcode colors. The theme system depends on this.
10. **Window is frameless**: `frame: false` in BrowserWindow config. Custom `Titlebar.tsx` at top.
11. **IPC safety**: Always use `safeRendererSend()` for `webContents.send` calls to prevent crashes on destroyed windows.
12. **Agent workspace restriction**: Agent file writes are restricted to `workspaceRootPath`. Build/BugFix modes are blocked when no workspace is open.

---

## Git Workflow

```bash
git add <specific-files>
git commit -m "Phase 9: Security hardening - IPC validation

- Added schema validation for all IPC handler arguments
- Migrated API keys to Electron safeStorage encryption
- Added command blocklist for agent terminal sessions

Co-Authored-By: Codex <noreply@openai.com>"
git push origin main
```

---

## Testing Checklist

After making changes, verify:
- [ ] `npm run build` succeeds with no errors
- [ ] `npx vitest run -c vitest.main.config.ts` passes
- [ ] `npx playwright test tests/app.spec.ts` passes
- [ ] App launches with `npm run electron`
- [ ] Chat works (send message, get streaming response)
- [ ] Code editor opens files, multi-tab works, Ctrl+P command palette works
- [ ] Terminal executes commands, shell selector works, multi-tab works
- [ ] File library shows files, project creation works, drag-drop works
- [ ] All 10 themes apply correctly
- [ ] Settings save and persist across restarts
- [ ] AI Pane shows in Code view with mode selector and task state
- [ ] Agent Plan mode generates plan, Approve button works, Build mode writes files
- [ ] llama.cpp settings UI works (health check, launch button)

---

## Documentation

- `docs/PLAN.md` - Master execution plan (all phases)
- `docs/TECH_SPEC.md` - Technical architecture and implementation details
- `docs/NEXT_STEPS.md` - Prioritized roadmap from Phase 9 onward
- `docs/PROGRESS.md` - Historical progress log
- `docs/ISSUES.md` - Prioritized issues and remaining work
- `docs/UX_SPEC.md` - UI/UX specifications
- `docs/CODEX_READ_THIS.md` - Quick-start guide for AI agents
- `docs/CODEX_CHECKIN_PROMPT.md` - Prompt for automated code review
- `docs/CURSOR_NEXT_PROMPT.md` - Prompt for Cursor IDE continuation
