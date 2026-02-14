# UX Specification

Comprehensive reference for every user-facing feature in AI Agent IDE.

---

## 1. Right-Side AI Pane (Code View)

### Layout
- **Position**: Right edge of the Code view, rendered as an `<aside>` element.
- **Default width**: 360 px (set via CSS).
- **Collapse / expand**: A toggle button (`>` / `<`) in the pane header. When collapsed the pane shrinks to a narrow strip with only the expand button visible. CSS transitions animate the width change. A `ResizeObserver` and manual `window.dispatchEvent(new Event('resize'))` calls keep the adjacent editor and terminal reflowed after every toggle.

### Sections (top to bottom, inside a scrollable container)

1. **Workspace meta** -- displays the current `workspaceRootPath` or "None (open a project first)".

2. **Runtime Diagnostics** (`ai-runtime-section`)
   - Summary grid: active request count, active model names, image model loaded (yes/no), last unload timestamp.
   - Active requests list (when count > 0): each row shows `provider/model`, request kind, phase badge (with phase-coloured CSS class), and a live elapsed-time counter that ticks every second.
   - Recent requests list (up to 6 most recent): kind, provider/model, outcome badge (`success`/`error`), and total duration.

3. **Current Task card** (shown when an `activeTask` is selected)
   - Goal text.
   - Status row: mode chip, status chip (underscores replaced with spaces), creation time chip.
   - Plan paragraph (if a plan has been generated).
   - Steps checklist: each step renders a marker (`ok` / `...` / `x` / `o`) and description, styled per `pending` / `in_progress` / `completed` / `failed`.
   - Action buttons: **Approve Plan** (enabled only when status is `waiting_approval`) and **Cancel** (enabled while the task is still active). A "Clear" link resets `activeTaskId`.

4. **File-Write Cards** (shown when the active task has file writes)
   - Reverse-chronological, capped at 40 visible cards.
   - Each card shows:
     - File path (truncated to 52 chars with middle ellipsis) and timestamp.
     - Byte delta (e.g. `delta +1234 bytes`).
     - Line-level add/remove summary (`+N` / `-N`).
     - Diff body: context, added, and removed lines with line numbers, markers (`+`, `-`, ` `), and coloured CSS classes.
     - Collapse / expand toggle. Initially collapsed to 6 lines. The toggle reports hidden line count including any server-side truncation.

5. **Coding Output** (shown when coding-mode responses exist, up to 8 retained)
   - Each response card: timestamp, collapsible **Reasoning** blocks (parsed from `<think>` tags), and a `<pre>` block of visible text.
   - **Save as New File** button (visible when a workspace is open): prompts for a filename and writes via `createWorkspaceFileFromAI`.

6. **Log Stream** (shown when an active task exists)
   - Scrollable div capped at `MAX_VISIBLE_LOGS` (400).
   - Each log line: timestamp, level class, and pre-formatted message.
   - **Follow / Pause** toggle: auto-scrolls to the bottom when following; pauses when the user scrolls up past a 24 px threshold.
   - **Jump to latest** button: appears when follow is paused; scrolls to bottom and re-enables follow.

### Footer (pinned to the bottom of the pane)

- **Controls row**:
  - Mode dropdown: Plan, Build, Code, Bug Fix (values `plan`, `build`, `coding`, `bugfix`).
  - Provider dropdown: Ollama, llama.cpp, OpenAI, Anthropic, Google, Groq.
  - Model text input with a `<datalist>` of available models (populated from `modelOptions` prop).

- **Toggle options** (checkbox labels):
  - Auto-run pipeline (`Auto-run Plan -> Approve -> Build -> Test`).
  - Insert at cursor (`Insert at cursor (instead of replace file)`) -- only shown when `onInsertAtCursor` is available.
  - Include all open files as context (`Include all open files as context (N files)`) -- only shown when more than one tab is open.

- **Input area**: Multiline `<textarea>` (Enter sends, Shift+Enter for newline) + **Send** button (shows "Working..." and is disabled while busy).

### Pane States
Six display states driven by agent events and task phase: `idle`, `thinking`, `writing`, `testing`, `done`, `error`. The current state label is shown in the header next to the "AI Assistant" title.

### Behavioral Notes
- **Plan mode**: AI generates a structured plan; user clicks Approve to proceed to build.
- **Build / Bug Fix modes**: Require an open workspace; show error toast "Open a project first." if `workspaceRootPath` is null.
- **Coding mode**: Direct code generation. Output is checked for unified diff format; if the response is a diff and an active file exists, it is patch-applied via `applyUnifiedDiff`. Otherwise, content is inserted at cursor (if cursor mode) or replaces the file.

---

## 2. Chat View

### Chat Area (`ChatPane`)
- Scrollable message history per conversation.
- Markdown rendering with syntax-highlighted code blocks.
- Code block action buttons: **Copy**, **Run in Terminal**, **Save as File**, **Open in Editor**.
- Inline image display for generated images (triggered by `/image` prefix).
- Context info banner shown when context window is auto-clamped.

### Request Lifecycle States
- **Thinking**: Shown immediately after request starts (before any tokens arrive). Gradient pulse or spinner.
- **Writing**: Shown once tokens begin streaming.
- **Done**: Cleared on completion (resets to idle after 1.5 s).
- **Error**: Cleared with error toast (resets to idle after 2.2 s).

### Reasoning Blocks
- `<think>` tags in model output are parsed and rendered as collapsible "Reasoning" blocks.
- Supports partial/open `<think>` blocks during streaming (live updates).
- Reasoning content is hidden by default, expandable by clicking the header.

---

## 3. Composer

### Input
- Auto-growing multiline `<textarea>` (max height 120 px).
- **Enter** sends; **Shift+Enter** inserts a newline.
- Placeholder text: "Send a message... (type / for commands)".

### Slash Command Menu
Five built-in commands with autocomplete:

| Command       | Description                              |
|---------------|------------------------------------------|
| `/image`      | Generate an image from a text prompt     |
| `/code`       | Generate code for a specific task        |
| `/explain`    | Explain a concept or code snippet        |
| `/fix`        | Fix a bug or issue in code               |
| `/summarize`  | Summarize text or a conversation         |

- Triggered when the input starts with `/` and contains no spaces.
- Arrow keys navigate; Tab or Enter selects; Escape dismisses.
- Filtered in real-time as the user types.

### File Attachments
- Paperclip button to attach files (via `pickWorkspaceFile` dialog).
- Maximum 5 attachments. Each appears as a removable chip above the input.
- Attached file content is prepended to the message as fenced code blocks on send.

### Send / Stop Button
- Arrow icon when idle; square icon while streaming.
- Clicking during streaming calls `onCancel` to abort the active request.

---

## 4. Sidebar

### Structure
- Collapsible vertical panel on the left edge.
- **Collapsed state**: Hamburger toggle, icon-only nav buttons (Chat, Code, Files, Modules), bottom section with Settings gear and "+" new chat.
- **Expanded state**: Hamburger toggle, "AI Agent IDE" brand text, "New Chat" button, labeled nav buttons (Chat, Code, Files, Modules), Settings button at bottom.

### Navigation Buttons
Five views: Chat, Code, Files (WorkspacePane), Modules (placeholder), Settings.

### Conversation List (visible only in Chat view)
- **Search input**: Filters conversations by title (case-insensitive substring match).
- "History" label above the list.
- Each item shows: title, relative timestamp (now, Nm, Nh, Nd, Nmo), hover-revealed action buttons (Rename pencil, Delete X).
- Rename: inline input replacing the title; commits on Enter or blur, cancels on Escape.
- Delete: immediate deletion via IPC.
- Active conversation highlighted.

---

## 5. Files Tab (`WorkspacePane`)

### Tab Bar
Two tabs: **Files** and **Agents**.

### Files Tab

#### Header
- "Library" heading.
- Action buttons: Sort dropdown, Sort direction arrow button, "+ Project", "+ File" (import), "Open Folder".

#### Sort Dropdown
Five options: Name, Size, Modified, Type, Custom. A toggle button switches between ascending and descending direction.

#### + Project
- Opens an inline form with a pre-filled name (`Project-YYYY-MM-DD`), Create and Cancel buttons.
- Creates a project folder under `user-files/projects/` with a `PROJECT.md` scaffold.

#### + File (Import)
- Opens a native file picker via `importFile` IPC.

#### Open Folder
- Opens the `user-files` directory in the OS file manager.

#### File Items
Each item displays:
- **Icon**: Type-aware emoji (folders, documents, images, audio, video, archives, code files, etc.).
- **Name**: Inline-editable when rename is active.
- **Meta**: "Project Folder" for directories, formatted size for files.
- **Open button**: "Open" (files, opens in editor) or "Open Project" (directories, sets workspace root and switches to Code view).
- **Delete button** (X): Visible on the row; confirms with a dialog before deletion.

#### Right-Click Context Menu
Appears at mouse position with these items:
- Download (files only, triggers Save As dialog)
- Open in Code
- Rename
- Move (opens destination picker)
- Duplicate (prompts for new name)
- Copy Path (copies to clipboard)
- View Details (opens details modal)
- Open in Explorer (reveals in OS file manager)
- Open Externally (files only, opens with default OS app)
- Delete (danger-styled)

#### File Details Modal
Overlay modal showing: Name, Type, Size, Created date, Modified date, full path. "Close" button to dismiss.

#### Drag and Drop
- **Internal drag**: Dragging a file onto a folder highlights the folder as a drop target; dropping moves the file via `moveFile` IPC.
- **Internal reorder**: Dragging a file onto another file shows an insertion indicator (before/after); dropping switches sort to Custom and updates the custom order array.
- **External drop (from OS)**: Files dropped onto the pane are imported via `importFileByPath` (or `importFileByBuffer` as fallback).

### Agents Tab

#### Header
"Agent Orchestration" heading with subtitle.

#### Task Creation
- Text input with placeholder ("Describe a goal...").
- "Start Task" button (disabled while creating or if input is empty).

#### Task Cards
Each card shows:
- Status badge and creation time.
- Goal heading.
- "Generating plan..." loading indicator (during planning phase).
- Plan summary (truncated to 150 chars).
- Steps list with status icons: checkmark (completed), hourglass (in_progress), X (failed), circle (pending).
- **Approve Plan & Execute** button (visible when status is `waiting_approval`).

---

## 6. Code Tab File Explorer (`FileExplorerPane`)

### Header
- "Explorer" label.
- **Open Folder** button (opens native folder picker).
- **Close Folder** button (X icon, visible when a root is open; clears root, expanded state, and entries).

### Tree View
- Auto-expands root folder when `rootPath` changes (e.g. when opening a project from Files tab).
- Hierarchical rendering with indentation (8 px base + 14 px per level).
- Folder items: expand/collapse chevron (triangle), folder icon, clickable name.
- File items: spacer (no chevron), file icon, clickable name (single-click opens; double-click also opens).
- Active file highlighted.

### Per-Item Context Menu (three-dot button)
For directories:
- New File (prompts for name)
- New Folder (prompts for name)
- Rename
- Copy Path
- Reveal in Explorer
- Delete (danger-styled, with confirmation)

For files:
- Open
- Rename
- Copy Path
- Reveal in Explorer
- Open Externally
- Delete (danger-styled, with confirmation)

Root folder additionally supports: New File, New Folder, Copy Path, Reveal in Explorer.

### Drag and Drop (from OS)
- **Single folder dropped (no root open)**: Opens as workspace root, auto-expands, and shows success toast.
- **Files dropped (root open)**: Imports into workspace root via `importFileToWorkspace` or `createWorkspaceFileFromAI` fallback. Shows count toast on success.

---

## 7. Terminal (`TerminalPane`)

### Implementation
- Built on `xterm.js` with `FitAddon` for responsive sizing.
- Each tab maintains its own real PTY process spawned via `terminalSpawn` IPC.
- PTY sessions are auto-killed when the renderer window is destroyed.

### Top Bar
- **Tabs**: Each tab shows its title and shell label. Active tab highlighted. Close button (x) on each tab (hidden when only one tab exists). Arrow key navigation between tabs.
- **Shell selector dropdown**: Lists detected shells (PowerShell, Command Prompt, Git Bash, WSL). Unavailable shells are shown disabled.
- **Add button (+)**: Creates a new terminal with the currently selected shell.
- **Split button**: Toggles horizontal split mode. Creates a second terminal pane if needed, or picks an existing non-active session.
- **Terminals button**: Opens a dropdown menu listing all sessions (with ARIA menu roles and full keyboard navigation).
- **Clear button**: Clears the active terminal.

### Behavior
- Switching tabs hides/shows the xterm instance without killing the PTY process.
- `ResizeObserver` on each container automatically calls `fitAddon.fit()` and `terminalResize` IPC on size changes.
- Exit codes are displayed inline on the tab when a process exits.

---

## 8. Monaco Editor (`EditorPane`)

### Editor
- Monaco editor (`@monaco-editor/react`) with custom `ai-agent-dark` theme.
- Language auto-detection from file extension (30+ languages mapped).
- Multi-tab support: open multiple files, click to switch, X to close.
- Modified indicator per tab (compares `content` vs `savedContent`).
- Tab renaming (renames file on disk if backed by a real file path).
- **Ctrl+S** save shortcut (writes to disk; shows warning toast for untitled files).

### AI Integration
- **Insert at Cursor**: AI-generated code injected at the current cursor position via `editorActions.insertAtCursor`.
- **Replace File**: Full file content replacement from AI output.
- **Diff/Patch Detection**: AI responses containing unified diffs are detected via `isDiff()` and applied via `applyUnifiedDiff()` to the active file content.

### Welcome Screen
When no tabs are open, the editor shows action links: New File, Open File, Open Folder, Open Recent Folder, and a list of recently opened files.

### Command Palette (`CommandPalette`)
- **Trigger**: `Ctrl+P`.
- **Functionality**: Fuzzy file search across the current workspace.
- Select a result to open the file in a new editor tab.

### Multi-File Context
All currently open editor tabs can be included as AI context (controlled by the "Include all open files" toggle in the AI Pane footer).

---

## 9. Settings (`SettingsPane`)

### Top Bar
- "Settings" heading.
- Live connection status dot (ok/fail/unknown) with click-to-refresh.
- System info summary (CPU count, RAM).
- **Save** button (shows "Saved!" for 2 seconds after save).

### Collapsible Sections

All sections use a toggle header with arrow indicator. Sections open/closed state is tracked per session.

#### Profile Picture
- Circular avatar preview (SVG placeholder when empty).
- **Upload** button (accepts png, jpeg, gif, webp, svg; reads as data URL).
- **Remove** button (visible when a picture is set).

#### General
- **Ollama Endpoint**: Text input (default `http://127.0.0.1:11434`).
- **Chat Model**: Dropdown of available models (falls back to text input if no models detected).
- **Context Window**: Numeric input (min 256, step 256).
- **Pull Model**: Text input + Pull button + Refresh button.
- **Theme**: Grid of 13 swatches, each showing the theme emoji, label, and accent colour. Active theme highlighted. Selection applies immediately via `applyTheme()`.

#### AI Provider
- Grid of 6 provider cards:
  - Ollama (llama emoji, connection status).
  - llama.cpp (computer emoji, "Local").
  - OpenAI (green circle, key status).
  - Anthropic (orange circle, key status).
  - Google (blue circle, key status).
  - Groq (lightning bolt, key status).
- Cards without API keys are styled as disabled and unclickable.
- Active provider has an `active` indicator class.
- Badge in the section header shows the current provider name.

#### llama.cpp / Local Server
- **Endpoint**: Text input (default `http://127.0.0.1:8080`).
- **Model**: Dropdown (populated after successful health check) or text input.
- **Binary**: Text input + **Browse** button (opens native file picker via `pickLlamaCppBinary`).
- **GGUF Model**: Text input + **Browse** button (opens native file picker via `pickLlamaCppModel`).
- **Test Connection** button: Checks health, populates model dropdown on success.
- **Launch Server** button: Disabled until both binary and GGUF paths are set.

#### Coding Model
- **Provider**: Dropdown (Ollama, llama.cpp, OpenAI, Anthropic, Google, Groq).
- **Model**: Dropdown of all available models (Ollama + llama.cpp combined) or text input.
- Badge in header shows current coding model.

#### Image Model
- **Provider**: Dropdown (Ollama, OpenAI, Anthropic, Google, Groq).
- **Model**: Dropdown of available image models (for Ollama) or text input.
- Auto-selects first available image model on load if none is set.
- Hint text: instructions for installing local image models via Ollama.

#### API Keys
- Four provider rows: OpenAI (`sk-...`), Anthropic (`sk-ant-...`), Google AI (`AIza...`), Groq (`gsk_...`).
- Each row: password input + show/hide toggle button (eye/lock icon).
- Badge in header shows count of configured keys.

#### AI Instructions
- Six mode-specific system prompt textareas: Chat, Coding, Plan, Build, Bugfix, Image.
- Changes saved on blur.

#### Permissions
- Three toggle switches (styled slider toggles):
  - **Run commands**: Allow agent to execute build/test commands.
  - **File writes**: Allow agent to create and modify files.
  - **AI code execution**: Allow AI to run generated code (labeled as dangerous).

#### Agent Safety Limits
- Six numeric inputs:
  - Max actions (min 1).
  - Max file writes (min 1).
  - Max commands (min 0).
  - Max bytes written (min 1024, step 1024).
  - Max violations (min 1).
  - Command timeout in ms (min 5000, step 1000).

#### Diagnostics & Tools
Three info cards:
- **Connection**: Shows Ollama status + Refresh button.
- **Diagnostics**: Full system check (server reachable, model found) + Run Check button.
- **Checkpoint**: Copy project snapshot prompt to clipboard + Copy Prompt button.

#### User Guide
Embedded documentation covering: Chat Tab usage, Code Tab features, AI Modes explanation, Files Tab overview, Keyboard Shortcuts quick reference, and local AI setup instructions.

---

## 10. Titlebar

- Custom frameless window titlebar (`Titlebar.tsx`).
- Window controls: minimize, maximize/restore, close.
- Window state synced via `window:stateChanged` IPC events (triggers layout refresh in AI Pane via `onWindowStateChanged` listener).
- Fullscreen exit before maximize/restore toggle to prevent stuck states.

---

## 11. Keyboard Shortcuts

Managed by a centralized `KeyboardShortcutManager` singleton. Shortcuts are registered at app startup and handled globally via a `keydown` listener on `window` (capture phase). Monaco editor shortcuts are excluded when focus is inside an editor instance.

### Registered Shortcuts

| Shortcut         | Action                    |
|------------------|---------------------------|
| `Ctrl+1`         | Switch to Chat View       |
| `Ctrl+2`         | Switch to Code View       |
| `Ctrl+3`         | Switch to Agents View     |
| `Ctrl+N`         | New Conversation          |
| `Ctrl+B`         | Toggle Sidebar            |
| `Ctrl+Shift+P`   | Keyboard Shortcuts Panel  |
| `Ctrl+O`         | Open File                 |
| `Ctrl+P`         | Quick Open (Command Palette) |
| `Ctrl+,`         | Open Settings             |
| `Ctrl+S`         | Save File                 |
| `Ctrl+Enter`     | Send Message (in composer) |
| `Ctrl+L`         | Focus Chat Input          |
| `Ctrl+E`         | Toggle File Explorer      |
| `Ctrl+Shift+T`   | Cycle Theme               |
| `Ctrl+``         | Toggle Terminal            |

### Shortcuts Panel
- Triggered by `Ctrl+Shift+P`.
- Overlay panel listing all registered shortcuts with their labels and key bindings.
- Click outside or the close button to dismiss.

---

## 12. Error Boundaries

- React class component (`ErrorBoundary`) wrapping every major view (Chat, Settings, WorkspacePane, Code layout, Modules).
- On uncaught render error:
  - Displays a recovery UI with a warning icon, "Something went wrong" heading, the error message (or a custom `fallbackMessage` prop), and a **Try Again** button.
  - Try Again resets the error state, causing the children to re-render.
- Errors are logged to `console.error` with React error info.

---

## 13. Glassmorphic Design System

### Theme Architecture
- 13 themes total: 10 dark (Glass, Forest, Ocean, Ember, Midnight, Slate, Sand, Rose, Cyber, Classic) and 3 light (Light, Light Ocean, Light Rose).
- Each theme defines ~30 design tokens via a `ThemeTokens` interface:
  - `label`, `emoji`, `agentEmoji`
  - Glass backgrounds: `glassBg`, `glassBgStrong`, `glassSidebar`, `glassElevated`, `glassInput`, `glassInputHover`
  - Borders: `borderHairline`, `borderSubtle`, `borderFocus`
  - Accent: `accent`, `accentHover`, `accentMuted`, `accentGlow`
  - Semantic: `danger`, `dangerMuted`, `success`, `warning`
  - Text: `textPrimary`, `textSecondary`, `textTertiary`, `textOnAccent`
  - Layout: `bodyBg`, `ambientA`, `ambientB`

### Application
- `applyTheme(name)` sets CSS custom properties on `document.documentElement.style` for all tokens.
- `document.body.style.background` is set to `bodyBg`.
- Light themes (`name.startsWith('light')`) additionally set `color-scheme: light` and add a `.theme-light` class to `document.body`.
- All component CSS references these custom properties exclusively. No hardcoded color values in component styles.

### Theme Picker
- Rendered as a grid in the Settings > General section.
- Each swatch is a button showing the theme's emoji and label, with background set to the theme's accent colour.
- Active theme swatch has an `active` class for a highlighted border.
- Selection triggers immediate `applyTheme()` and persists via settings save.

---

## 14. Session Persistence

- App state is persisted across reloads via `getSessionState` / `setSessionState` IPC:
  - Current view, sidebar collapsed state, workspace root path, explorer visibility, terminal visibility.
- Settings (including theme, model names, API keys, prompts, permissions, safety limits) are persisted via `getSettings` / `setSettings` IPC.
- Conversation history is loaded from the database on startup; if no conversations exist, a new one is auto-created.

---

## 15. Toast Notifications

- Stacked toast messages rendered by the `Toast` component.
- Three types: `error` (red), `warning` (yellow), `success` (green).
- Auto-dismiss with animation; manual dismiss via click.
- Used throughout the app for operation feedback (file saves, task creation, connection status, errors).

---

## 16. Download Shelf

- A bottom shelf showing recently created/downloaded files (up to 5).
- Each item shows file name, "Ready for download/use" status, a **Show** button (reveals in OS explorer), and a close button.
