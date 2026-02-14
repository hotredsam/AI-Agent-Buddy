# AI Agent IDE -- Next Steps & Roadmap

## Current State (February 2026)

Phases 1-8 are complete. The app is a fully functional AI IDE with:
- 6 AI providers (Ollama, llama.cpp, OpenAI, Anthropic, Google, Groq)
- Monaco code editor with AI injection hooks, diff/patch detection, command palette
- Multi-file context awareness (all open tabs sent as AI context)
- Agent task system (plan/build/test pipeline with approval gate)
- Real PTY terminal (xterm.js + node-pty) with shell selector and multi-tab
- Full file library with CRUD, drag-drop, context menus, sort indicators, delete on hover
- SQLite-backed job queue (basic, needs expansion)
- 13 themes (10 dark glassmorphic + 3 light), permissions system, runtime diagnostics
- Keyboard shortcut system (KeyboardShortcutManager, 13 defaults, Ctrl+Shift+P panel)
- Session state persistence (view, sidebar, workspace path)
- Error boundaries with crash recovery UI
- Conversation search in sidebar
- File attachments in Composer (paperclip, max 5)
- Profile picture upload in Settings
- 28 Playwright E2E tests passing

---

## Phase Overview

| Phase | Description | Priority |
|-------|-------------|----------|
| **9** | Security Hardening (IPC validation, key encryption, terminal safety) | **HIGH** |
| **10** | Provider Routing Intelligence (cost-aware, fallback chains) | MEDIUM |
| **11** | Context & Token Intelligence (usage tracking, cost estimation) | MEDIUM |
| **12** | Persona Engine (Builder/Auditor/Planner/Refactorer) | MEDIUM |
| **13** | Advanced Security & Reliability (concurrency, rate limiting, audit logs) | LOW |
| **14** | 24/7 Orchestration Daemon (Python hybrid, scheduling, auto-restart) | LOW |

---

## Phase 9: Security Hardening -- HIGH PRIORITY

**Must be done before any distribution.**

### 9a. IPC Input Validation
- Validate and sanitize all IPC handler arguments (string lengths, path formats, enum values).
- Add schema validation at the `ipcMain.handle` boundary.
- Reject malformed payloads with descriptive errors.
- Key files: `src/main/ipc.ts`

### 9b. File Safety
- Audit all file operations for path traversal vulnerabilities.
- Ensure all workspace paths resolve within expected roots.
- Add blocklist for sensitive file patterns (`.env`, credentials, etc.) in agent writes.
- Key files: `src/main/store.ts`, `src/main/agent-runner.ts`

### 9c. API Key Encryption
- Use Electron `safeStorage` API to encrypt API keys at rest.
- Current state: keys stored as plain text in `settings.json`.
- Migration: decrypt on read, encrypt on write, handle OS keychain unavailability gracefully.
- Key files: `src/main/store.ts`, `src/main/ipc.ts`

### 9d. Terminal Safety
- Implement command blocklist for dangerous operations in agent-controlled terminal sessions.
- Add per-session resource limits (max output buffer, execution timeout).
- Key files: `src/main/agent-runner.ts`, `src/main/ipc.ts`

---

## Phase 10: Provider Routing Intelligence

### 10a. Cost-Aware Selection
- Classify tasks by complexity (simple lookup vs. complex reasoning).
- Route simple tasks to local models, complex tasks to cloud providers.
- Expose cost estimates in the AI Pane before sending requests.

### 10b. Fallback Chains
- Define ordered fallback sequences per provider slot (e.g., Ollama -> llama.cpp -> OpenAI).
- Automatic retry on provider failure with next provider in chain.
- Health check integration: skip unhealthy providers.

### 10c. Per-Task Routing
- Allow different providers for different agent phases (plan with cloud, build with local).
- UI: per-mode provider override in Settings.

---

## Phase 11: Context & Token Intelligence

### 11a. Usage Tracking
- Count tokens per request using provider-reported usage or local tiktoken estimation.
- Display per-conversation token totals and per-request breakdowns.

### 11b. Context Window Management
- Show context utilization percentage in the AI Pane.
- Automatic context reduction when approaching limits: summarize older messages, drop least-relevant context.

### 11c. Cost Estimation
- Calculate estimated cost for cloud provider requests before sending.
- Running cost total per session and per conversation.

---

## Editor Intelligence

### Ghost Text Completions
- Register a Monaco `InlineCompletionsProvider` that queries the coding model with current file context.
- Show ghost text suggestions that accept on Tab.
- Add debounce (500ms) and caching. Toggle in settings.

### Inline Chat (Ctrl+I)
- Floating input widget in the editor (like Cursor's inline chat).
- Selected code sent as context. AI response replaces or appends to selection.

### Code Actions
- Register Monaco `CodeActionProvider` for "Fix with AI" and "Explain" actions.
- Response appears in a diff preview.

### Symbol Search (Ctrl+Shift+O)
- Use Monaco's built-in document symbol provider.
- Regex-based symbol extractor as fallback for languages without built-in support.

---

## Agent System V2

### Multi-Turn Conversations
- Maintain rolling conversation history per agent task.
- After each action result, feed the outcome back to the model for the next decision.
- Support `think` action type for model reasoning without side effects.

### Workspace Awareness
- Generate workspace manifest (file tree, file sizes, language breakdown) before step execution.
- Inject manifest into system prompt.
- Allow `read_file` action type for the agent to inspect existing code.

### Diff Review Before Apply
- Stage file writes as diffs instead of writing immediately.
- User can review, accept/reject individual changes, or accept all.
- Side-by-side diff comparison viewer.

### Pipeline Templates
- Predefined templates: "Build Feature", "Fix Bug", "Refactor", "Add Tests", "Code Review".
- Each template pre-configures system prompt, mode, and auto-run settings.

---

## Module System

### Plugin Architecture
- Module system where modules are npm packages exporting `IDEModule` interface.
- `ModuleAPI` provides access to editor, terminal, file system, and AI generation.

### Built-in Modules
- **Git Integration** -- Git status, diff viewer, commit/push from UI.
- **Linter** -- Run ESLint/Prettier on save, show inline diagnostics.
- **Markdown Preview** -- Live preview pane for .md files.

### Marketplace UI
- Modules pane shows installed modules with enable/disable toggles.
- "Browse" tab for discovering community modules from a registry.

---

## Polish & Production

### Auto-Update System
- Integrate `electron-updater` for auto-update via GitHub Releases.
- Show update notification in the titlebar.

### App.tsx Decomposition
- Split ~900-line `App.tsx` into: `AppLayout.tsx`, `ChatView.tsx`, `CodeView.tsx`, `useConversations.ts`, `useAgent.ts`, `useSettings.ts`.

### Performance Optimization
- Code-split the renderer bundle using dynamic imports for Monaco, xterm, and heavy components.
- Lazy-load the agent runner and terminal components.
- Add virtual scrolling for large chat histories and file lists.

### Image Generation Pipeline
- Proper UI for `/image` command (preview, save, regenerate).
- Support Stable Diffusion via llama.cpp's image endpoint.

---

## Job Queue Expansion (Parallel Track)

The job queue subsystem (`src/main/jobs/`) needs expansion alongside the main roadmap:

1. **Worker with handler registry** - Register typed job handlers, implement retry with exponential backoff.
2. **Cancellation** - Support graceful job cancellation with cleanup.
3. **IPC contract** - Expose `jobs.list`, `jobs.create`, `jobs.cancel`, `jobs.logs`, `jobs.subscribeUpdates` to renderer.
4. **Jobs panel UI** - Renderer component showing pending/processing/completed/failed jobs with log viewer.
5. **Real job handlers** - `indexFiles`, `generateTests`, `agentTaskRun`, `runCommand`, `summarizeFile`.

---

## Known Open Issues

### HIGH: Security (Phase 9)
1. **API keys stored in plaintext** - `settings.json` contains unencrypted API keys. Must migrate to Electron `safeStorage`.
2. **IPC input validation missing** - IPC handlers accept arguments without schema validation.
3. **Agent terminal commands unsandboxed** - Agent can execute arbitrary commands during build/test.

### MEDIUM: Intelligence
4. **No automatic failover** - If the active provider is down, requests fail with no fallback.
5. **No cost awareness** - Cloud requests have no cost estimation or budget controls.
6. **No token tracking** - Token usage not counted or displayed.

### LOW: Technical Debt
7. **Job queue incomplete** - Has basic CRUD but no worker registry, retry, or UI.
8. **App.tsx is ~900 lines** - Should be decomposed into smaller components and hooks.
9. **Window transparency deferred** - Acrylic/vibrancy effects disabled for Windows edge-resize compatibility.

---

## Testing Gates

### Required before every merge
1. `npm run build` (Vite + tsc for all three targets)
2. `npx vitest run -c vitest.main.config.ts` (main-process unit tests)
3. `npx playwright test tests/app.spec.ts` (E2E smoke tests)

All three must pass on the same commit.
