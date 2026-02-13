# AI Agent IDE - Cursor-like Transformation Plan

## 1. Workflow & Agent Orchestration (The "Cursor" Feel)
- [ ] **Refactor `src/main/agent-runner.ts`**:
    - [ ] Implement state machine: `Idle` -> `Planning` -> `WaitingForApproval` -> `Building` -> `Testing` -> `Done`.
    - [ ] Implement `planTask(goal)`: Generates `docs/PLAN.md`.
    - [ ] Implement `startBuild(taskId)`: Executes the plan step-by-step.
    - [ ] Implement `runTests(taskId)`: Runs verification commands.
- [ ] **Documentation**:
    - [ ] Agent automatically creates/updates `docs/PLAN.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`.
- [ ] **Permissions Gate**:
    - [ ] Restrict file writes to `Building` state.
    - [ ] Require explicit user approval before entering `Building` state.

## 2. Files Tab = Real Project Workspace
- [ ] **Backend (`src/main/store.ts`)**:
    - [ ] Ensure `user-files` acts as the container for Project folders.
    - [ ] Add `createProject(name)` API.
- [ ] **Frontend (`src/renderer/components/WorkspacePane.tsx`)**:
    - [ ] Rebuild as a "Library" view showing Project cards/folders.
    - [ ] Implement Drag-and-Drop (projects ordering, file moving).
    - [ ] Add Context Menu (Right-click: New, Rename, Delete, etc.).
    - [ ] Add Search/Filter bar.

## 3. Code Tab & Live Visibility
- [ ] **Streaming Actions**:
    - [ ] Update `generateCode` to stream structured "Tools/Actions" (e.g., `<write_file path="...">...`) instead of just text.
    - [ ] Create `AgentActionsPanel` in Code view to show live edits (diffs).
- [ ] **Modes**:
    - [ ] Wire up "Plan / Build / Bug Fix" dropdown to the `agent-runner`.

## 4. Terminal (VS Code-like)
- [ ] **Tabs**: Add multi-tab support to `TerminalPane.tsx`.
- [ ] **Shell Support**: Add shell selection (PowerShell, CMD, Bash, WSL).

## 5. UI/Nav Polish
- [ ] **Sidebar**: Move to vertical icon stack (VS Code style).
- [ ] **Theme**: Refine Glass theme for new panels.
- [ ] **Thinking Indicator**: Add "Thinking..." state visualization in Chat.

## 6. Stability & Performance
- [ ] **Context Window**: Implement safe context checks / fallback logic in `src/main/ollama.ts`.
- [ ] **Timeouts**: Fix request timeouts (increase limits, add abort controller).
- [ ] **Diagnostics**: Add VRAM/RAM usage to "System" settings card.

## 7. Architecture
- [ ] **Refactor**: Ensure clean separation of concerns.
