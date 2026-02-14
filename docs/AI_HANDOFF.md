# AI Agent IDE -- Read This First

> **This is the primary handoff document. Read this entire file before writing any code or making any changes.**

---

## Project Summary

A local-first AI IDE built with **Electron 33.4.0 + React 19 + TypeScript 5.9 + Vite 7.3**. Glassmorphic design with 13 themes (10 dark + 3 light). Supports 6 AI providers (Ollama, llama.cpp, OpenAI, Anthropic, Google, Groq). Features Monaco code editor, real PTY terminal, file library, agent task system, keyboard shortcuts, session persistence, error boundaries, and SQLite-backed job queue.

**Current State**: Phases 1-8 complete. All features working. 28 E2E tests passing. Build clean. The next priority is **Phase 9: Security Hardening**.

---

## Architecture

### Directory Structure

```
src/
  main/
    index.ts          # App lifecycle, BrowserWindow config (frameless, frame:false)
    ipc.ts            # ALL IPC handlers (chat, files, terminal, agent, settings, diagnostics)
    ollama.ts          # Ollama client (streaming, health, models, image generation)
    llamacpp.ts        # llama.cpp client (OpenAI-compatible streaming, health, models)
    openai.ts          # OpenAI streaming client
    anthropic.ts       # Anthropic streaming client
    google.ts          # Google Gemini streaming client
    groq.ts            # Groq streaming client
    agent-runner.ts    # Agent orchestration (plan/build/test state machine, batch actions)
    store.ts           # JSON persistence (conversations, messages, settings, user files, session state)
    runtime-diagnostics.ts  # Request tracking, model monitoring, diagnostics broadcast
    jobs/
      JobQueue.ts      # SQLite-backed job queue (CRUD)
      runner.ts        # Job runner/worker
  preload/
    index.ts           # contextBridge exposing electronAPI to renderer
  renderer/
    main.tsx           # React entry point
    App.tsx            # Root component (~900 lines): state management, routing, all handlers
    types.ts           # TypeScript interfaces (Settings, ElectronAPI, AgentTask, etc.)
    themes.ts          # 13 themes with CSS variable injection via applyTheme()
    shortcuts.ts       # KeyboardShortcutManager singleton (13 default shortcuts)
    agents.ts          # Agent config stubs
    utils/
      patchApply.ts    # Unified diff detection and application
    components/
      AIPane.tsx          # Right-side AI pane (Code view)
      ChatPane.tsx        # Chat messages with markdown, code blocks, reasoning
      CodeMenuBar.tsx     # Code view top menu bar
      CommandPalette.tsx  # Ctrl+P fuzzy file search
      Composer.tsx        # Message input with slash commands, file attachments
      EditorPane.tsx      # Monaco editor with multi-tab
      ErrorBoundary.tsx   # React error boundary with recovery UI
      FileExplorerPane.tsx # File explorer tree with drag-drop
      SettingsPane.tsx    # Settings with collapsible sections
      Sidebar.tsx         # Vertical nav + conversation list + search
      TerminalPane.tsx    # xterm.js terminal with shell selector
      Titlebar.tsx        # Custom frameless window titlebar
      Toast.tsx           # Toast notification system
      WorkspacePane.tsx   # File library + agents tab
    styles/
      globals.css         # Full design system (~3200+ lines)
tests/
  app.spec.ts            # 28 Playwright E2E tests
docs/                    # Project documentation
```

### IPC Pattern

```
Renderer -> window.electronAPI.method() -> preload (ipcRenderer.invoke) -> main (ipcMain.handle)
```

All `webContents.send` calls are guarded by `safeRendererSend()` to prevent crashes on destroyed windows.

**When adding a new feature**, follow these four steps in order:

1. Add the IPC handler in `src/main/ipc.ts`
2. Add the bridge method in `src/preload/index.ts`
3. Add the type to the `ElectronAPI` interface in `src/renderer/types.ts`
4. Call from the React component via `window.electronAPI.newMethod()`

### AI Providers

| Provider | Module | Protocol | Default Endpoint |
|----------|--------|----------|------------------|
| Ollama | `ollama.ts` | Native Ollama API | `http://127.0.0.1:11434` |
| llama.cpp | `llamacpp.ts` | OpenAI-compatible | `http://127.0.0.1:8080` |
| OpenAI | `openai.ts` | OpenAI API | `https://api.openai.com` |
| Anthropic | `anthropic.ts` | Anthropic Messages API | `https://api.anthropic.com` |
| Google | `google.ts` | Gemini API | `https://generativelanguage.googleapis.com` |
| Groq | `groq.ts` | OpenAI-compatible | `https://api.groq.com` |

### Data Storage

All app data lives in the Electron `userData` directory:

- `app-data/conversations.json` -- Conversation metadata
- `app-data/messages/{id}.json` -- Messages per conversation
- `app-data/settings.json` -- App settings (API keys currently stored in plaintext)
- `app-data/session-state.json` -- Session persistence (window layout, active tabs, scroll positions)
- `user-files/projects/` -- File library root

### Store

The store (`src/main/store.ts`) uses `crypto.randomUUID()` for all ID generation. **Do NOT use the `uuid` npm package** -- it is ESM-only and breaks the CommonJS main process with `require()`.

---

## What Is Done (Phases 1-8)

1. **Foundation** -- Project creation, path safety, startup stability
2. **AI Pane** -- Right-side AI pane with mode selector, thinking indicators, reasoning blocks
3. **Agent System** -- Plan/approve/build/test state machine with IPC events and batch actions
4. **Terminal** -- Real PTY terminal with shell selector, multi-tab, split mode
5. **Monaco Editor** -- AI injection hooks, diff/patch detection, command palette, multi-file context
6. **Cloud Providers** -- OpenAI, Anthropic, Google, Groq integrations with streaming
7. **llama.cpp** -- Streaming, health check, settings UI, server launch
8. **Polish** -- Conversation search, session persistence, error boundaries, keyboard shortcuts (13 defaults), file attachments, profile picture, 13 themes (10 dark + 3 light), drag-drop everywhere, documentation rewrite

---

## What To Do Next (Phase 9: Security Hardening)

### 1. IPC Input Validation
- Add schema validation at the `ipcMain.handle` boundary for all handlers
- Validate string lengths, path formats, enum values
- Reject malformed payloads with descriptive errors
- Key files: `src/main/ipc.ts`

### 2. File Safety Audit
- Audit all file operations for path traversal beyond workspace boundaries
- Ensure all workspace paths resolve within expected roots
- Add blocklist for sensitive file patterns (`.env`, credentials) in agent writes
- Key files: `src/main/store.ts`, `src/main/agent-runner.ts`

### 3. API Key Encryption via safeStorage
- Migrate from plaintext `settings.json` storage to Electron `safeStorage` API
- Encrypt on write, decrypt on read
- Handle OS keychain unavailability gracefully (fallback with warning)
- Key files: `src/main/store.ts`, `src/main/ipc.ts`

### 4. Terminal Command Sandboxing
- Implement command blocklist for dangerous operations in agent-controlled terminal sessions
- Add per-session resource limits (max output buffer, execution timeout)
- Key files: `src/main/agent-runner.ts`, `src/main/ipc.ts`

---

## Build & Test

```bash
npm run build         # vite build + tsc (main + preload)
npm run start         # build + launch
npm run dev:electron  # dev mode with hot reload
npx playwright test   # 28 E2E tests
npx vitest run -c vitest.main.config.ts  # main-process unit tests
```

All gates (build, E2E tests, unit tests) must pass before any commit is considered complete.

---

## Common Pitfalls

1. **contextIsolation**: No Node.js APIs available in the renderer. Everything must go through the preload bridge (`window.electronAPI`).
2. **TypeScript strict mode**: All three tsconfig files have `strict: true`. No implicit any allowed.
3. **Main process + preload = CommonJS**: `tsconfig.main.json` and `tsconfig.preload.json` use `"module": "commonjs"`. The renderer is ESM, bundled by Vite.
4. **Do NOT use the `uuid` package**: Use `crypto.randomUUID()` instead. The `uuid` package is ESM-only and breaks `require()` in the CommonJS main process.
5. **CSS variables only**: Always use `var(--name)` in CSS. Never hardcode colors. The theme system depends on this.
6. **Window is frameless**: `frame: false` in BrowserWindow config. The custom `Titlebar.tsx` component handles window controls.
7. **safeRendererSend()**: Use this wrapper for all `webContents.send` calls. It guards against sending to destroyed windows.
8. **ELECTRON_RUN_AS_NODE**: This environment variable must be deleted in the test environment, otherwise Electron runs as a plain Node.js process instead of launching the GUI.

---

## Review Checklist

Use this checklist when reviewing the codebase after changes:

1. **Build Health**: Does `npm run build` compile cleanly?
2. **Type Safety**: Any TypeScript errors or `any` leaks in the IPC bridge?
3. **Security**: Is contextIsolation enabled? Is nodeIntegration disabled? Are IPC arguments validated? Any XSS vectors? Are API keys encrypted?
4. **Provider Correctness**: Do all 6 streaming flows handle errors, partial responses, and abort signals?
5. **Agent Safety**: Does `agent-runner.ts` enforce workspace write boundaries? Are safety limits respected?
6. **Data Persistence**: Are conversations and settings stored reliably? Does session state persist? Any race conditions?
7. **UI Completeness**: Does the AI Pane show task state, steps, logs, and diffs? Terminal multi-tab? Error boundaries? Keyboard shortcuts? All 13 themes?
8. **IPC Robustness**: Are all `webContents.send` calls guarded by `safeRendererSend`?
9. **Dead Code**: Any unused imports, unreachable code, or leftover scaffolding?
10. **Test Coverage**: Do E2E tests cover critical paths (project creation, AI pane, terminal, agent approval, error boundaries, shortcuts)?

Run this checklist after any major feature addition, before packaging, after refactoring IPC/store/provider logic, and weekly during active development.
