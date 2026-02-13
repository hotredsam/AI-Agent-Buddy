# Technical Specification

## 1. File System & Sandboxing (Fixing "Files Tab")
- **Problem**: `path.resolve(directory)` in `store.ts` resolves relative to CWD, not `user-files`.
- **Fix**:
  ```typescript
  // src/main/store.ts
  const targetDir = directory 
    ? path.resolve(getUserFilesDir(), directory) // Enforce user-files root
    : getUserFilesDir();
  
  if (!targetDir.startsWith(getUserFilesDir())) {
    throw new Error("Security Error: Cannot create file outside workspace.");
  }
  ```
- **Project Creation**: Explicitly create the directory first, then creating files inside it.

## 2. Right-Side AI Pane (Renderer)
- **Component**: Create `src/renderer/components/AIPane.tsx`.
- **Integration**: Update `CodeLayout` in `App.tsx` to use a 3-column grid: `[Explorer (left)] [Editor (center)] [AIPane (right)]`.
- **State**: Move `messages`, `isStreaming`, `agentTask` state into a context or centralized store accessible by both `ChatPane` (sidebar) and `AIPane` (code view).

## 3. Agent State & IPC
- **Events**:
  - `agent:plan-generated` -> Payload: `{ plan: string, steps: Step[] }`
  - `agent:step-start` -> Payload: `{ stepId: string }`
  - `agent:step-log` -> Payload: `{ message: string }` (for visibility)
  - `agent:file-diff` -> Payload: `{ path: string, diff: string }`
- **Runner (`src/main/agent-runner.ts`)**:
  - Needs to emit these events via `webContents.send`.
  - Must accept a `mode` argument in `createAgentTask`.

## 4. Terminal Shell Selection
- **Discovery**: On app startup (or first terminal open), scan common paths:
  - `C:\Windows\System32\cmd.exe`
  - `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`
  - `C:\Program Files\Git\bin\bash.exe`
  - `wsl.exe`
- **IPC**: Update `terminal:spawn` to accept `shellPath: string`.
- **Renderer**: `TerminalPane.tsx` maintains a list of available shells and passes the selection to the main process.

## 5. Streaming & Thinking Tags
- **Parser**: Implement a transform stream or regex parser in `src/renderer/components/MarkdownRenderer.tsx` (or similar).
- **Regex**: `/(<think>)([\s\S]*?)(<\/think>)/g`
- **Replacement**: Replace with `<ThinkingBlock content="$2" />`.

## 6. Window Transparency
- **Main Process**:
  - `transparent: true` is already set.
  - **Fix**: Ensure `backgroundColor` uses a specialized HEX with alpha (e.g., `#00000000`) AND verify `vibrancy` settings for macOS. For Windows, `electron-acrylic-window` might be needed for true blur, but basic transparency just needs the CSS `html, body { background: transparent }` and the browser window config.
  - *Note*: If standard transparency fails on Windows 11, focus on functionality first.
