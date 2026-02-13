# Master Execution Plan (Codex Edition)

## Phase 1: Fixing the Foundation (The "Broken" Features)
- [ ] Fix "+ Project" button in `WorkspacePane.tsx`. Ensure absolute path resolution in `src/main/store.ts`.
- [ ] Implement robust path validation for all file writes.
- [ ] Stabilize `window.electronAPI` checks to prevent crashes on startup.

## Phase 2: The Cursor Workflow (UI/UX)
- [ ] Implement right-side AI Side-Pane in `Code` view.
- [ ] Move top-bar prompt logic into Side-Pane.
- [ ] Add Mode pill selector (Plan/Build/Code/Fix).
- [ ] Implement `<think>` tag parsing and styling in Chat/AI views.

## Phase 3: The Agent Runner (Logic)
- [ ] Update `src/main/agent-runner.ts` to push state updates via IPC events.
- [ ] Implement `docs/` auto-generation (PLAN.md, DECISIONS.md).
- [ ] Wire up "Approve" button to trigger step-by-step building.
- [ ] Add "Review Diffs" screen in the Side-Pane.

## Phase 4: Professional Workspace & Terminal
- [ ] Implement real Drag-and-Drop in `WorkspacePane.tsx`.
- [ ] Add right-click context menu for all library items.
- [ ] Implement terminal tabs and shell selector (PowerShell/CMD/Bash).

## Phase 5: Reliability & Performance
- [ ] Increase HTTP timeouts for local inference.
- [ ] Implement Abort/Cancel logic for all AI calls.
- [ ] Add RAM/VRAM best-effort estimate to Settings info card.
- [ ] Implement context window guardrails (auto-reduce vs crash).

## Phase 6: Aesthetic Refinement
- [ ] Enable Windows Acrylic/Vibrancy effects.
- [ ] Refine "Glass" theme CSS variables.
- [ ] Add animations for side-pane collapse/expand.
