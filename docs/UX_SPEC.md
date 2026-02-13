# UX Specification: Cursor-like Experience

## 1. The Right-Side AI Pane (The "Brain")
*Replacement for the current top-bar input.*

- **Layout**:
  - **Position**: Right side of the Code view. Width: ~350px (resizable).
  - **Toggle**: `Ctrl+L` or a button in the top-right of the window.
- **Components**:
  - **Chat Area**:
    - Scrollable history of the current *coding session*.
    - **Thinking Block**: Collapsible accordion labeled "Thinking..." (with animation) that contains the raw `<think>` output.
    - **Artifacts**: Plans, Code Blocks, and Terminal Commands render as distinct cards.
  - **Input Area (Bottom)**:
    - Multiline Textarea (auto-growing).
    - **Mode Dropdown**: [Plan ▼] (Options: Plan, Code, Build, Fix).
    - **Send Button**: Arrow icon (changes to "Stop" square when busy).
- **Behavior**:
  - **Plan Mode**: Output is rendered as a checklist. User clicks "Approve" to proceed to Build mode.
  - **Build Mode**: Streams file edits. Shows a "Working on [filename]..." spinner.

## 2. Thinking Indicator
- **Detection**: Parse stream for `<think>` and `</think>` tags.
- **State**:
  - `Idle`: No indicator.
  - `Thinking`: Gradient pulse or spinner. Text: "Reasoning...".
  - `Outputting`: Stream text as normal.
- **Render**: The content inside `<think>` tags is hidden by default, expandable by clicking the "Reasoning" header.

## 3. Files Tab (Professional Workspace)
- **Hierarchy**:
  - **Top Level**: Projects (Folders).
  - **Second Level**: Files/Folders inside the project.
- **Interactions**:
  - **Right-Click**: Opens a native-styled context menu at the mouse position.
    - Items: *New File, New Folder, Rename, Delete, Duplicate, Copy Path, Reveal in Explorer*.
  - **Drag & Drop**:
    - Dragging a file *onto* a folder highlights the folder.
    - Dropping moves the file on disk.
    - Dragging a project reorders the visual list.

## 4. Terminal (Multi-Shell)
- **Header**:
  - **Tabs**: `[Terminal 1 x] [ + v ]`.
  - **Add Button**: Clicking `+` creates a default shell. Clicking `v` shows a dropdown:
    - PowerShell
    - Command Prompt
    - Git Bash (if detected)
    - WSL (if detected)
- **Behavior**: Each tab maintains its own PTY process ID. Switching tabs hides/shows the xterm instance without killing the process.

## 5. Agent Visibility (Code Tab)
- **Diff View**:
  - When the agent writes code, show a "Proposed Change" card in the AI Pane.
  - Left side: Original line. Right side: New line (Green background).
  - Actions: [Accept] [Reject].
- **Status Bar**:
  - Bottom of the window (or top of AI pane).
  - Shows: "Agent: Writing src/app.tsx..."
