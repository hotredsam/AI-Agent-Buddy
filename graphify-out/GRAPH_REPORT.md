# Graph Report - .  (2026-06-07)

## Corpus Check
- 58 files · ~55,073 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 479 nodes · 761 edges · 41 communities (32 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_LLM Provider Adapters|LLM Provider Adapters]]
- [[_COMMUNITY_Agent Runner Core|Agent Runner Core]]
- [[_COMMUNITY_App State Store|App State Store]]
- [[_COMMUNITY_NPM Dependencies|NPM Dependencies]]
- [[_COMMUNITY_AI Pane Component|AI Pane Component]]
- [[_COMMUNITY_Job Queue|Job Queue]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Dev Dependencies|Dev Dependencies]]
- [[_COMMUNITY_Shared Types|Shared Types]]
- [[_COMMUNITY_Chat Pane Markdown|Chat Pane Markdown]]
- [[_COMMUNITY_Settings & Themes|Settings & Themes]]
- [[_COMMUNITY_Main TS Config|Main TS Config]]
- [[_COMMUNITY_App Shell & Titlebar|App Shell & Titlebar]]
- [[_COMMUNITY_Preload TS Config|Preload TS Config]]
- [[_COMMUNITY_Workspace Pane|Workspace Pane]]
- [[_COMMUNITY_Error Boundary|Error Boundary]]
- [[_COMMUNITY_Terminal Pane|Terminal Pane]]
- [[_COMMUNITY_Keyboard Shortcut Manager|Keyboard Shortcut Manager]]
- [[_COMMUNITY_Enqueue Stress Test|Enqueue Stress Test]]
- [[_COMMUNITY_Monaco Editor Pane|Monaco Editor Pane]]
- [[_COMMUNITY_React Entry Point|React Entry Point]]
- [[_COMMUNITY_Shortcut Definitions|Shortcut Definitions]]
- [[_COMMUNITY_Command Palette|Command Palette]]
- [[_COMMUNITY_File Explorer Pane|File Explorer Pane]]
- [[_COMMUNITY_Conversation Sidebar|Conversation Sidebar]]
- [[_COMMUNITY_Message Composer|Message Composer]]
- [[_COMMUNITY_Toast Notifications|Toast Notifications]]
- [[_COMMUNITY_Diff Patch Apply|Diff Patch Apply]]
- [[_COMMUNITY_Code Menu Bar|Code Menu Bar]]
- [[_COMMUNITY_Agent Config Presets|Agent Config Presets]]
- [[_COMMUNITY_Codex Agent Launcher|Codex Agent Launcher]]
- [[_COMMUNITY_Local Permissions Settings|Local Permissions Settings]]
- [[_COMMUNITY_Pane Props Types|Pane Props Types]]

## God Nodes (most connected - your core abstractions)
1. `ensureStorageExists()` - 17 edges
2. `runAgentTask()` - 14 edges
3. `getUserFilesDir()` - 14 edges
4. `ensureUserFilesDir()` - 14 edges
5. `compilerOptions` - 14 edges
6. `broadcastUpdate()` - 13 edges
7. `emitEvent()` - 13 edges
8. `appendLog()` - 13 edges
9. `compilerOptions` - 12 edges
10. `JobQueue` - 11 edges

## Surprising Connections (you probably didn't know these)
- `planAgentTask()` --calls--> `generateCodeWithProvider()`  [EXTRACTED]
  src/main/agent-runner.ts → src/main/ipc.ts
- `runAgentTask()` --calls--> `generateCodeWithProvider()`  [EXTRACTED]
  src/main/agent-runner.ts → src/main/ipc.ts
- `AIPaneProps` --references--> `Settings`  [EXTRACTED]
  src/renderer/components/AIPane.tsx → src/renderer/types.ts
- `SettingsPaneProps` --references--> `Settings`  [EXTRACTED]
  src/renderer/components/SettingsPane.tsx → src/renderer/types.ts
- `WorkspacePaneProps` --references--> `UserFile`  [EXTRACTED]
  src/renderer/components/WorkspacePane.tsx → src/renderer/types.ts

## Import Cycles
- None detected.

## Communities (41 total, 9 thin omitted)

### Community 0 - "LLM Provider Adapters"
Cohesion: 0.05
Nodes (50): AnthropicStreamChunk, GeminiStreamChunk, GroqStreamChunk, chatAbortControllers, commandExists(), FolderEntry, generateCodeWithProvider(), generateImageWithProvider() (+42 more)

### Community 1 - "Agent Runner Core"
Cohesion: 0.07
Nodes (57): activeTasks, AgentActionType, AgentDiffKind, AgentDiffLine, AgentDiffPreview, AgentEvent, AgentExecutionBudget, AgentFileWrite (+49 more)

### Community 2 - "App State Store"
Cohesion: 0.11
Nodes (51): addMessage(), Conversation, createConversation(), createUserFile(), createUserProject(), DEFAULT_AGENT_SAFETY, DEFAULT_PERMISSIONS, DEFAULT_SESSION_STATE (+43 more)

### Community 3 - "NPM Dependencies"
Cohesion: 0.07
Nodes (26): author, dependencies, better-sqlite3, electron-builder, mammoth, monaco-editor, @monaco-editor/react, node-pty (+18 more)

### Community 4 - "AI Pane Component"
Cohesion: 0.12
Nodes (10): AIPane(), CodingResponse, formatTime(), OpenTab, PaneState, paneStateLabel(), AgentDiffLine, AgentEvent (+2 more)

### Community 5 - "Job Queue"
Cohesion: 0.13
Nodes (7): AddJobInput, JobLogRow, JobQueue, JobRow, JobStatus, main(), sleep()

### Community 6 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+8 more)

### Community 7 - "Dev Dependencies"
Cohesion: 0.12
Nodes (16): devDependencies, electron, @playwright/test, react, react-dom, tsx, @types/better-sqlite3, @types/node (+8 more)

### Community 8 - "Shared Types"
Cohesion: 0.12
Nodes (15): AgentDiffKind, AgentDiffPreview, AgentFileWrite, AgentLogEntry, AgentPhase, AgentStep, AgentTaskCreatePayload, AgentTestRun (+7 more)

### Community 9 - "Chat Pane Markdown"
Cohesion: 0.23
Nodes (11): ChatPane(), ChatPaneProps, formatCtx(), MarkdownImage(), normalizeImageSource(), renderBlocks(), renderInline(), renderMarkdown() (+3 more)

### Community 10 - "Settings & Themes"
Cohesion: 0.22
Nodes (11): API_PROVIDERS, DEFAULT_AGENT_SAFETY, SectionKey, applyTheme(), applyTokens(), BASE_THEME_NAMES, generateLightVariant(), THEME_NAMES (+3 more)

### Community 11 - "Main TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, composite, esModuleInterop, forceConsistentCasingInFileNames, lib, module, outDir, resolveJsonModule (+5 more)

### Community 13 - "Preload TS Config"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, module, outDir, rootDir, skipLibCheck, strict, target (+1 more)

### Community 14 - "Workspace Pane"
Cohesion: 0.33
Nodes (7): formatDate(), formatFileSize(), WorkspacePane(), WorkspacePaneProps, AgentTask, UserFile, UserFileInfo

### Community 15 - "Error Boundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, ErrorBoundaryProps, ErrorBoundaryState

### Community 16 - "Terminal Pane"
Cohesion: 0.32
Nodes (6): defaultShells(), TerminalPane(), TerminalPaneProps, TerminalSessionState, TerminalSessionViewProps, TerminalShellOption

### Community 18 - "Enqueue Stress Test"
Cohesion: 0.25
Nodes (7): db, dbPath, info, jobId, prompt, promptPath, root

### Community 19 - "Monaco Editor Pane"
Cohesion: 0.29
Nodes (4): EditorActions, EditorPaneProps, EditorTab, MONACO_LANG_MAP

### Community 21 - "Shortcut Definitions"
Cohesion: 0.29
Nodes (5): DEFAULT_SHORTCUTS, MONACO_SHORTCUTS, RegisteredShortcut, ShortcutEntry, shortcutManager

### Community 23 - "File Explorer Pane"
Cohesion: 0.40
Nodes (4): baseName(), FileExplorerPaneProps, folderName(), WorkspaceEntry

### Community 24 - "Conversation Sidebar"
Cohesion: 0.40
Nodes (3): SidebarProps, View, Conversation

### Community 25 - "Message Composer"
Cohesion: 0.40
Nodes (3): Attachment, ComposerProps, SLASH_COMMANDS

### Community 27 - "Diff Patch Apply"
Cohesion: 0.50
Nodes (4): applyUnifiedDiff(), Hunk, isDiff(), parseHunks()

### Community 32 - "Pane Props Types"
Cohesion: 0.67
Nodes (3): AIPaneProps, SettingsPaneProps, Settings

## Knowledge Gaps
- **187 isolated node(s):** `allow`, `name`, `version`, `description`, `main` (+182 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `KeyboardShortcutManager` connect `Keyboard Shortcut Manager` to `Shortcut Definitions`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **What connects `allow`, `name`, `version` to the rest of the system?**
  _187 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `LLM Provider Adapters` be split into smaller, more focused modules?**
  _Cohesion score 0.0525879917184265 - nodes in this community are weakly interconnected._
- **Should `Agent Runner Core` be split into smaller, more focused modules?**
  _Cohesion score 0.06892655367231638 - nodes in this community are weakly interconnected._
- **Should `App State Store` be split into smaller, more focused modules?**
  _Cohesion score 0.11463046757164404 - nodes in this community are weakly interconnected._
- **Should `NPM Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `AI Pane Component` be split into smaller, more focused modules?**
  _Cohesion score 0.12418300653594772 - nodes in this community are weakly interconnected._