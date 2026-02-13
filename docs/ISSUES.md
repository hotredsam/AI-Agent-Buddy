# Prioritized Issues (Owner Reported)

## P0: Critical Functionality Broken
1.  **Files Tab: "+ Project" Button Does Nothing**
    *   **Repro**: Open app -> Click "Files" tab -> Click "+ Project" -> Enter a name (e.g., "MyProject") -> Press OK.
    *   **Observed**: Dialog closes, no folder appears in the list, no folder created in `user-files`.
    *   **Likely Cause**: `src/main/store.ts` -> `createUserFile` uses `path.resolve(directory)`. If `directory` is a name like "MyProject", it resolves to the *application CWD* (e.g., `C:\Users\...\AI Agent IDE\MyProject`) instead of inside the `user-files` directory. The UI only watches `user-files`.
    *   **Acceptance**: A new folder appears immediately in the Files list; the folder exists on disk inside `app-data/user-files`.

2.  **Code Tab: Missing AI Prompt Pane (Cursor-like)**
    *   **Repro**: Open Code tab.
    *   **Observed**: Only a standard file editor and a top bar with a small input field exist. No right-side panel for chat/planning.
    *   **Acceptance**: A dedicated, collapsible right-side sidebar exists in the Code view containing the AI chat/prompt interface.

3.  **Missing "Thinking" Indicator**
    *   **Repro**: Send a prompt to Ollama (GLM model).
    *   **Observed**: The response contains raw `<think>` tags interspersed with text. No visual distinction for the "thought" process.
    *   **Acceptance**: `<think>` content is hidden behind a collapsible "Thinking..." UI element or styled distinctively (greyed out).

4.  **Local Image Model: No UX / High RAM**
    *   **Repro**: Attempt to generate an image.
    *   **Observed**: System RAM spikes (model loads), but the UI shows no progress, no placeholder, and the result (if any) is not displayed clearly.
    *   **Acceptance**: A dedicated "Generating Image..." state in the chat, followed by the image appearing inline.

5.  **Plan/Build/Test Workflow Not Visible**
    *   **Repro**: Select "Plan" mode in the top bar and run a task.
    *   **Observed**: A toast says "Task started", and you have to manually switch to the "Agents" tab in the *Files* pane to see it. The Code view (where you work) shows nothing of this process.
    *   **Acceptance**: The Plan/Steps/Progress are visible *inside* the Code view (in the new Right Pane), not hidden in a separate tab.

## P1: Missing Core Features
6.  **Mode Selector in Prompt Pane**
    *   **Requirement**: The new Right Pane must have a selector for **Plan**, **Build**, **Code**, **Bug Fix**.
    *   **Current State**: Only exists in the deprecated top bar.

7.  **Terminal Shell Selector**
    *   **Repro**: Open Terminal.
    *   **Observed**: Hardcoded to PowerShell (Windows) or Bash. No way to switch to CMD, Git Bash, or WSL.
    *   **Acceptance**: A dropdown menu in the terminal title bar allowing the user to spawn specific shells.

8.  **Files Tab: Broken Organization UX**
    *   **Repro**: Try to drag a file into a folder. Right-click a file.
    *   **Observed**: Dragging just reorders the list visually (ghosting) without changing file paths. Right-click does nothing (custom menu is on a tiny `...` button).
    *   **Acceptance**: True filesystem move on drop. Native-like right-click context menu (Rename, Delete, Reveal).

9.  **Lack of Visibility (Diffs/Logs)**
    *   **Repro**: Agent is "building".
    *   **Observed**: Files just change on disk. No visual diff of what is being written.
    *   **Acceptance**: A "Review" UI showing the proposed code changes (diff view) before they are applied (or as they stream).

10. **Window Transparency**
    *   **Repro**: Launch app on Windows.
    *   **Observed**: Background is solid black/grey.
    *   **Acceptance**: Application background is semi-transparent/blurred (Acrylic/Vibrancy effect) where supported.
