## P0-R3 AI Pane Workflow Reliability + UX Fixes (2026-02-13)
- Fixed Plan approval flow reliability:
  - `runAgentTask` now treats approved `plan` tasks as build-entry tasks (no dead-end approve path).
  - Added test-only task fixture IPC for deterministic Playwright approval-flow validation (without mutating frozen `electronAPI` methods).
- Improved Code-tab AI pane UX:
  - bottom-pinned input/footer with a dedicated scroll container for long logs/plans.
  - readable dark dropdown styles for mode/provider controls.
  - runtime diagnostics section (active requests/models, image model state, last unload).
- Added live reasoning parsing improvements:
  - supports partial/open `<think>` blocks during streaming.
  - reasoning block updates live while streaming and remains collapsible.
- Verification:
  - `npm run build` passed.
  - `npx playwright test tests/app.spec.ts` passed (17/17).

## P0-R4 Runtime Diagnostics, Cancellation, and Local Image Flow (2026-02-13)
- Added runtime request tracking in main process:
  - active request count + active model list + request metadata.
  - image model loaded flag + last unload timestamp.
  - broadcast channel: `runtime:diagnostics`.
- Added Ollama concurrency/resource protections:
  - blocks concurrent Ollama inferences by default to prevent duplicate background model runs.
  - unloads prior tracked model when switching models (best-effort), with timestamp tracking.
- Added explicit chat cancellation path:
  - IPC `chat:cancel` with `AbortController` cleanup.
  - renderer stop control in composer (send button becomes stop while streaming).
- Implemented local `/image` support path:
  - `imageProvider = ollama` now calls local OpenAI-compatible image endpoint (`/v1/images/generations`).
  - image responses (`b64_json` or URL fallback) are saved to local library and rendered inline in chat.
  - image request placeholder shown while generating.
- Hardened terminal IPC crash path:
  - guarded PTY event sends to destroyed renderers.
  - auto-kills PTY sessions when associated renderer is destroyed.
- Verification:
  - `npm run build` passed.
  - `npx playwright test tests/app.spec.ts` passed (17/17).

## P1-R1 Terminal + Files UX (2026-02-13)
- Terminal:
  - added shell discovery + selector (`PowerShell`, `CMD`, `Git Bash`, `WSL` when available).
  - added multi-terminal tabs, add terminal action, terminal list menu, and basic split mode.
- Files tab:
  - added right-click context menu for file/folder actions.
  - implemented drag/drop move into folders via `files:moveFile` (real filesystem move).
  - added drop-target highlight feedback.
- Sidebar/hamburger navigation:
  - switched nav button stack to vertical layout (no horizontal tiny-tab row).
- Verification:
  - `npm run build` passed.
  - `npx playwright test tests/app.spec.ts` passed (17/17), including:
    - terminal shell selector/tabs/split
    - sidebar vertical stack
    - AI pane scrolling/approve flow
    - project creation path checks

## P0-R1 Project Creation Reliability + Instrumentation (2026-02-13)
- Standardized project library root to `userData/user-files/projects` (explicit projects root).
- Added deeper instrumentation for project creation:
  - renderer: `WorkspacePane` logs click chain and post-create existence checks
  - preload: `createProject` bridge invocation logs
  - main IPC: existing request logs retained
  - store: logs for function call, selected root/path, mkdir/write success/failure
- Improved user-visible failure message for duplicate/existing project names.
- Verification:
  - `npm run build` passed.
  - `npx playwright test tests/app.spec.ts --grep "files tab can create new project"` passed.
  - Test now also asserts created project path is under `user-files/projects`.

## P0-R2 Window Maximize/Restore Regression (2026-02-13)
- Explicitly enabled frameless window resize-related capabilities in BrowserWindow config (`resizable`, `maximizable`, `fullscreenable`, etc.).
- Hardened maximize IPC behavior:
  - toggles maximize/unmaximize reliably
  - exits fullscreen before restore/maximize toggle to prevent stuck fullscreen state
- Added window state event channel (`window:stateChanged`) and renderer subscription so titlebar state stays synced after OS/window manager actions.
- Verification:
  - `npm run build` passed.
  - `npx playwright test tests/app.spec.ts --grep "window maximize can restore back down"` passed.

## P0-1 Project Creation Fix (2026-02-13)
- Implemented explicit `files:createProject` flow and replaced the old `createFile` workaround from the `+ Project` button.
- Fixed `createUserFile` path resolution to always resolve relative to `user-files` and added inside-root security checks.
- Added `createUserProject(projectName)` in `store.ts` to create:
  - project folder under Library root
  - `PROJECT.md` scaffold with project name, created timestamp, and workspace root path
- Added main/renderer logging and error handling so project creation failures are no longer silent.
- Verification:
  - `npm run build` passed.
  - `npx playwright test tests/app.spec.ts --grep "files tab can create new project"` passed.

## P0-2 Right-Side AI Pane (2026-02-13)
- Added `src/renderer/components/AIPane.tsx` and integrated it into Code view layout as a dedicated right sidebar.
- Removed prompt/mode controls from `CodeMenuBar`; they now live in the right pane.
- Added pane UI primitives for:
  - prompt input
  - mode selector (Plan/Build/Code/Bug Fix)
  - auto-run pipeline toggle
  - current task card, step list, approve/cancel actions
  - file-write cards and log stream sections
- Verification:
  - `npm run build` passed.
  - `npx playwright test tests/app.spec.ts --grep "code view shows right-side ai pane"` passed.

## P0-3 Thinking/Writing Lifecycle + Reasoning Blocks (2026-02-13)
- Added request lifecycle state handling in chat flow: `Thinking -> Writing -> Done/Error`.
- Updated `ChatPane` top-bar status badge to reflect lifecycle state from request events.
- Added `<think>...</think>` parsing in chat markdown rendering and display as collapsible `Reasoning` blocks.
- Added ChatPane lifecycle/Reasoning styles in `globals.css`.
- Verification:
  - `npm run build` passed.
  - `npx playwright test tests/app.spec.ts --grep "chat shows thinking lifecycle state when request starts"` passed.

## P0-4 Plan/Build/Test Visibility + Workflow Wiring (2026-02-13)
- Rebuilt `src/main/agent-runner.ts` to support:
  - explicit mode-aware task creation (`plan`/`build`/`bugfix`)
  - lifecycle phases (`thinking`, `writing`, `testing`, `done`, `error`)
  - structured live events (`agent:event`) + task snapshots (`agent:update`)
  - cancel support (`agent:cancelTask`)
  - testing phase commands (in order, stop on first failure):
    - `npm run build`
    - `npx tsc --noEmit`
    - `npm test` only when `package.json` has a `test` script
- Updated preload and renderer type contracts for new agent payloads/events.
- Wired `AIPane` to show task state, checklist steps, approve gate, cancel action, file-write cards, and live logs (including command output).
- Verification:
  - `npm run build` passed.
  - `npx playwright test tests/app.spec.ts --grep "build mode is blocked when no workspace is open"` passed.

## P0-5 Workspace Write Safety Enforcement (2026-02-13)
- Enforced agent file writes to `workspaceRootPath` only via normalized path checks in `agent-runner.ts`.
- Blocked Build/BugFix flows when no workspace root is open with clear UI feedback (`Open a project first.`).
- Preserved explicit exception for Library project creation (`+ Project`) under `user-files` root.
- Added timestamped write logs with path + byte deltas and compact diff previews in the right AI pane.
- Verification:
  - `npm run build` passed.
  - `npx playwright test tests/app.spec.ts --grep "files tab can create new project"` passed.
  - `npx playwright test tests/app.spec.ts --grep "build mode is blocked when no workspace is open"` passed.

## Execution Block 1 Refinements (Completed)
- Sidebar/menu interaction simplification and vertical nav coherence (A04)
- Code menu and editor welcome UX parity (A01)
- Code AI pane UX modes and status indicators (A02)
- Download UX refinement with dismissable shelf (User request 9)
- Chat code block action menu expansion (User request 8)

## Gemini Investigation & Handoff Preparation (2026-02-12)
- Performed comprehensive audit of existing features vs. requirements.
- Identified critical bugs in "Files" tab (broken project creation) and missing UI elements (AI side-pane, shell selector).
- Documented technical and UX specifications for reaching Cursor-level parity.
- Created `docs/CODEX_READ_THIS.md` as the primary entry point for the next agent.
- Documented prioritized issues in `docs/ISSUES.md`.
- No code changes performed; purely architectural and planning phase.

## Gemini Re-Evaluation (2026-02-12)
- Refined handoff docs (`CODEX_READ_THIS.md`) to be strictly focused on P0 owner-reported issues.
- Updated `ISSUES.md` with detailed root cause analysis for Project Creation failure (path resolution).
- Defined precise UX spec for the missing Right-Side AI Pane and Thinking indicators.
- Prepared the repo for Codex to immediately start fixing the broken "+ Project" button and implementing the AI side-pane.
