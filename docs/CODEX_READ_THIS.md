# CODEX: READ THIS FIRST (V2)

**Critical Instruction**: You are here to fix broken functionality and missing UI features reported by the owner. Do NOT implement "nice to have" features until P0 issues are resolved.

## PROJECT SUMMARY
A local-first AI IDE (Electron/React).
**Current State**: Core "Plan/Build" logic exists in backend but is disconnected from UI. Files tab is broken. Terminal is basic. No right-side AI pane.

## P0 CHECKLIST (DO THESE FIRST)

### 1. Fix Project Creation (Files Tab)
- **Problem**: "+ Project" button does nothing.
- **Root Cause**: `src/main/store.ts` -> `createUserFile` resolves paths incorrectly (relative to CWD instead of `user-files`).
- **Fix**: Update `createUserFile` to strictly resolve paths relative to `getUserFilesDir()`.
- **Verify**: Click "+ Project", enter "Test", verify folder appears in list and on disk.

**Mandatory triage before changing store.ts** (do in this order):
1) Confirm the "+ Project" button has an onClick handler and it is firing (renderer console log).
2) Confirm the handler calls a preload API method (window.electronAPI.*) OR an internal renderer action.
3) Confirm preload exposes the method (src/preload/index.ts).
4) Confirm main registers an IPC handler (src/main/ipc.ts) and it is being invoked (main log).
5) Confirm the store function runs and does not throw (wrap with try/catch + log error).
Only after steps 1–5 should you change path logic.

**Acceptance criteria (expanded)**:
- Clicking "+ Project" creates a folder *and* the UI refreshes without restart.
- Folder persists after app restart.
- Errors show a visible toast + log, not silent failure.


### 2. Implement Right-Side AI Pane
- **Problem**: Missing the "Cursor-like" right sidebar in Code view.
- **Fix**: 
  - Create `src/renderer/components/AIPane.tsx`.
  - Update `src/renderer/App.tsx` (Code view layout) to include this pane.
  - Move the "Coding AI" prompt inputs from `CodeMenuBar.tsx` to this new pane.
- **Verify**: A collapsible pane appears on the right side of the editor.

### 3. Implement "Thinking" UI (request lifecycle, not just tags)
- **Goal**: Match Ollama app feel: show "Thinking…" immediately after a request starts, then "Writing…" as tokens stream, then "Done".
- **Do NOT rely on <think> tags.** If <think> tags appear in model output, render them as a collapsible "Reasoning" block, but the primary indicator must be driven by request state/events.
- **Verify**:
  - Start an AI request: within 100ms UI shows "Thinking…"
  - While streaming tokens: state shows "Writing…"
  - On completion: "Done"
  - On cancel/error: clear state and show error


### 4. Wire Agent Workflow
- **Problem**: "Plan/Build" modes don't visually update the user in the Code view.
- **Fix**: 
  - Ensure `agent-runner.ts` emits events (`agent:update`).
  - Subscribe to these events in `AIPane.tsx`.
  - Show the Plan checklist and "Approve" button directly in the right pane.
- **Verify**: Select "Plan", type "Make a todo app", see the plan generate in the side pane.

**Right-side AI Pane must include**:
- Prompt textbox
- Mode selector menu: Plan / Build / Code (optional: Bug Fix)
- Toggle: "Auto-run Plan→Approve→Build→Test" (when enabled, default behavior is Plan first, then shows Approve gate)
- Visible step queue + live status (Thinking/Writing/Testing)
- "Approve" and "Cancel" buttons

**Verify (expanded)**:
- Plan mode: produces a checklist plan in the pane.
- Approve required before any file writes.
- Build: creates/edits files while showing file-by-file progress and diffs/logs.
- Test: runs configured checks and reports pass/fail.


## P1 CHECKLIST (DO NEXT)

### 5. Terminal Shell Selector
- **Problem**: Can't switch shells (PowerShell/CMD/Bash).
- **Fix**: 
  - Update `ipc.ts` to accept `shellPath`.
  - Update `TerminalPane.tsx` to list available shells and pass the choice to `spawn`.

**Windows shell detection**:
- PowerShell: "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" (fallback: pwsh if installed)
- CMD: "C:\Windows\System32\cmd.exe"
- Git Bash (if installed): typical locations under Program Files\Git\bin\bash.exe
- WSL (if available): "C:\Windows\System32\wsl.exe" (launch distro default)
Fallback if none found: show disabled items + explain missing dependency.


### 6. Fix Files Drag/Drop & Context Menu
- **Problem**: Organizing files is broken/clunky.
- **Fix**: 
  - Implement standard HTML5 Drag-and-Drop in `WorkspacePane.tsx` that triggers `files:moveFile`.
  - Replace the `...` button with a native-style custom context menu (`onContextMenu`).

## NOTES
- **Window Transparency**: If `transparent: true` is set in `main/index.ts` but background is black, check `src/renderer/styles/globals.css`. Ensure `body` and `#root` have `background: transparent` or `rgba(..., 0.X)`.
- **Image Model**: If local generation consumes 20GB RAM but fails, ensure the IPC handler isn't timing out or swallowing the output path. Add distinct error logging.

## IMPLEMENTATION ORDER
1. **Fix Store Paths** (Unblocks Project Creation).
2. **Create AI Pane** (Unblocks UX).
3. **Wire Agent Logic** (Unblocks Workflow).
4. **Fix Terminal & Files UX** (Polish).
