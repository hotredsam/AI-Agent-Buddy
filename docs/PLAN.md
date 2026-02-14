# AI Agent IDE -- Master Plan

## Status Key
- [x] Complete
- [ ] Not started / In progress

---

## Phase 1: Foundation Fixes (COMPLETE)
- [x] Fix "+ Project" button path resolution in `store.ts` (enforce `user-files` root).
- [x] Implement robust path validation for all file writes.
- [x] Stabilize `window.electronAPI` checks to prevent crashes on startup.
- [x] Standardize project library root to `userData/user-files/projects`.

## Phase 2: Cursor-like Workflow & UI (COMPLETE)
- [x] Implement right-side AI Pane (`AIPane.tsx`) in Code view.
- [x] Move prompt logic from top-bar into AI Side-Pane.
- [x] Add mode selector (Plan / Build / Code / Bug Fix).
- [x] Implement `<think>` tag parsing and collapsible Reasoning blocks.
- [x] Add request lifecycle states (Thinking / Writing / Done / Error).
- [x] Wire Plan/Build/Test visibility into the AI Pane with Approve gate.

## Phase 3: Agent Runner & Task System (COMPLETE)
- [x] Rebuild `agent-runner.ts` with state machine (planning -> approval -> building -> testing -> done).
- [x] Emit structured IPC events (`agent:update`, `agent:event`).
- [x] Implement cancel support (`agent:cancelTask`).
- [x] Testing phase runs `npm run build`, `npx tsc --noEmit`, and `npm test` in sequence.
- [x] Workspace write safety enforcement (agent writes restricted to `workspaceRootPath`).
- [x] Plan approval auto-creates workspace project when missing.
- [x] Multi-file batch actions (`parseBatchActions` for `{"actions": [...]}` format).

## Phase 4: Professional Workspace & Terminal (COMPLETE)
- [x] Real PTY terminal (xterm.js + node-pty) with shell discovery and selector.
- [x] Multi-terminal tabs, add terminal action, split mode.
- [x] Right-click context menu for file/folder actions.
- [x] Drag-and-drop file move into folders (`files:moveFile`).
- [x] Drag-and-drop reordering with custom sort order.
- [x] Drag-and-drop files from OS into Code tab explorer.
- [x] Vertical sidebar navigation (VS Code-style icon stack).

## Phase 5: Monaco Editor & Code Intelligence (COMPLETE)
- [x] Replace `<textarea>` with Monaco editor (`@monaco-editor/react`).
- [x] Custom dark theme matching glassmorphic design.
- [x] Multi-tab file support with language auto-detection.
- [x] AI injection hooks (insert at cursor, replace file).
- [x] Diff/patch detection and application from AI responses.
- [x] Command palette (Ctrl+P) with fuzzy file search.
- [x] Multi-file context awareness (include all open tabs as AI context).

## Phase 6: Multi-Provider & Cloud APIs (COMPLETE)
- [x] OpenAI streaming client (`openai.ts`).
- [x] Anthropic streaming client (`anthropic.ts`).
- [x] Google Gemini streaming client (`google.ts`).
- [x] Groq streaming client (`groq.ts`).
- [x] Provider routing in `ipc.ts` based on `activeProvider` setting.
- [x] Per-provider API key management in Settings.

## Phase 7: llama.cpp Integration (COMPLETE)
- [x] New provider module: `src/main/llamacpp.ts` (OpenAI-compatible streaming).
- [x] Health check and model listing via llama-server API.
- [x] Settings UI: endpoint, model name, binary/GGUF path with Browse buttons, health check, launch button.
- [x] `llamacpp` added as selectable provider for chat, coding, and image generation.
- [x] Default configuration for Qwen3 Coder 30B (Q4_K_M quantization).
- [x] Model dropdown populated after successful health check.

## Phase 7.5: UX Polish & Feature Gaps (COMPLETE)
- [x] Conversation search (filter by title in sidebar).
- [x] Session state persistence (view, sidebar, workspace path restored on launch).
- [x] Error boundaries wrapping all views with crash recovery UI.
- [x] Keyboard shortcut system (`KeyboardShortcutManager` with 13 default shortcuts, Ctrl+Shift+P panel).
- [x] File attachments in Composer (paperclip button, max 5, content prepended to message).
- [x] Profile picture upload in Settings (base64 storage, circular avatar).
- [x] "Save as New File" button for AI coding responses.
- [x] Close folder button in File Explorer.
- [x] Auto-expand root folder when opened in Code tab.
- [x] Sort indicator arrows in Files tab.
- [x] 13 themes (10 dark + 3 light variants).
- [x] File delete button on hover in Files tab.
- [x] Browse buttons for llama.cpp binary and GGUF model paths.

## Phase 8: Documentation Rewrite (COMPLETE)
- [x] Rewrite all `docs/*.md` files to reflect current codebase state.
- [x] Update architecture, feature list, and roadmap across all docs.
- [x] Consolidate 11 docs into 5 (AI_HANDOFF, PLAN, NEXT_STEPS, TECH_SPEC, UX_SPEC).

---

## Phase 9: Security Hardening
- [ ] IPC input validation (sanitize all handler arguments with schema validation).
- [ ] File safety guards (audit and prevent path traversal beyond workspace).
- [ ] API key encryption at rest (use Electron `safeStorage` or OS keychain).
- [ ] Concurrency guards for agent task execution (single active task).
- [ ] Terminal command sandboxing (blocklist dangerous commands in agent mode).

## Phase 10: Provider Routing Intelligence
- [ ] Cost-aware provider selection (prefer local models for simple tasks).
- [ ] Automatic fallback chains (e.g., Ollama -> llama.cpp -> cloud provider).
- [ ] Provider health monitoring with automatic failover.
- [ ] Per-task provider routing (plan with cloud, build with local).

## Phase 11: Context & Token Intelligence
- [ ] Token usage tracking per request and per conversation.
- [ ] Context window utilization display in AI Pane.
- [ ] Automatic context reduction (summarize older messages when nearing limit).
- [ ] Token cost estimation for cloud providers.

## Phase 12: Persona Engine
- [ ] Define persona profiles: Builder, Auditor, Planner, Refactorer.
- [ ] Per-persona system prompts and behavioral constraints.
- [ ] Persona-aware task routing (Planner for plan mode, Builder for build mode).
- [ ] Custom persona creation via Settings UI.

## Phase 13: Advanced Security & Reliability
- [ ] Concurrent request queuing (prevent duplicate Ollama model loads).
- [ ] Terminal session isolation and resource limits.
- [ ] Rate limiting for cloud API calls.
- [ ] Audit logging for all agent actions.

## Phase 14: 24/7 Orchestration Daemon
- [ ] Python hybrid process for long-running background orchestration.
- [ ] Electron health monitoring and auto-restart.
- [ ] Scheduled task execution (cron-like job scheduling).
- [ ] Cross-session state persistence and recovery.

---

## Future Tracks

### Editor Intelligence
- [ ] Inline code completion (ghost text) via Monaco `InlineCompletionsProvider`.
- [ ] Inline chat (Ctrl+I) floating widget for quick AI questions about selected code.
- [ ] Code actions ("Fix with AI", "Explain") via Monaco `CodeActionProvider`.
- [ ] Symbol search (Ctrl+Shift+O) with document symbol provider.

### Agent System V2
- [ ] Multi-turn agent conversations (rolling history per task).
- [ ] Agent workspace awareness (file tree manifest in system prompt, `read_file` action).
- [ ] Diff review before apply (staged diffs with accept/reject per file).
- [ ] Agent pipeline templates ("Build Feature", "Fix Bug", "Add Tests", etc.).

### Module System
- [ ] Module architecture (`IDEModule` interface with `activate`/`deactivate`).
- [ ] Built-in modules: Git integration, Linter, Markdown preview, Database viewer.
- [ ] Module marketplace UI (browse, install, enable/disable).

### Polish & Production
- [ ] Auto-update system via `electron-updater` + GitHub Releases.
- [ ] App.tsx decomposition (split into `ChatView`, `CodeView`, custom hooks).
- [ ] Performance optimization (code-splitting Monaco/xterm, virtual scrolling).
- [ ] Image generation pipeline with preview, save, regenerate UI.

### Job Queue Subsystem
- [x] SQLite-backed job queue (`src/main/jobs/JobQueue.ts`) via better-sqlite3.
- [x] Basic CRUD operations and job runner (`src/main/jobs/runner.ts`).
- [x] Vitest test harness (`vitest.main.config.ts`).
- [ ] Worker with handler registry, retry/backoff, and cancellation.
- [ ] IPC contract for renderer (create/list/logs/cancel jobs).
- [ ] Jobs panel UI in renderer.
- [ ] Real job handlers (index files, generate tests, agent task run).

---

## Progress Log

### Phase 8: Documentation Rewrite (2026-02-14)
- Rewrote all docs/*.md to reflect current codebase
- Consolidated 11 doc files into 5

### Phase 7.5: UX Polish & Feature Gaps (2026-02-14)
- Conversation search in sidebar
- Session state persistence (view, sidebar, workspace path)
- Error boundaries with crash recovery UI
- Keyboard shortcut system (KeyboardShortcutManager, 13 defaults, Ctrl+Shift+P panel)
- File attachments in Composer (paperclip, max 5)
- Profile picture upload in Settings
- "Save as New File" for AI coding responses
- Close folder button in explorer
- Auto-expand root folder on open
- Sort indicators, file delete button on hover
- 3 light themes added (total 13)
- Browse buttons for llama.cpp paths
- Drag-drop reordering, drag-drop from OS into explorer

### Phase 7: llama.cpp Integration (2026-02-13)
- Added `src/main/llamacpp.ts` with OpenAI-compatible streaming via `llama-server` REST API
- Health check, model listing, server launch from Settings UI
- Default configuration targets Qwen3 Coder 30B (Q4_K_M quantization)
- 600s streaming timeout with `AbortSignal.any()`

### Phases 5-6: Monaco Editor & Multi-Provider (2026-02-13)
- Monaco editor with custom `ai-agent-dark` theme, multi-tab, AI injection hooks
- Diff/patch detection from AI responses, command palette (Ctrl+P)
- Multi-file context: all open tabs included as AI context
- Cloud provider streaming: OpenAI, Anthropic, Google Gemini, Groq
- Provider routing based on `activeProvider` setting

### Phases 1-4: Foundation through Terminal (2026-02-13)
- Project creation reliability, path safety, startup stability
- AI Pane with mode selector, thinking indicators, reasoning blocks
- Agent state machine (plan/approve/build/test), IPC events, batch actions
- Real PTY terminal (xterm.js + node-pty), shell discovery, multi-tab, split mode
- File library with drag-drop, context menus, vertical sidebar navigation
- Runtime diagnostics, Ollama concurrency protections, chat cancellation
- Window maximize/restore reliability, frameless window hardening
