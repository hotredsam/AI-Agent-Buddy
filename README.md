# AI Agent IDE (AI Agent Buddy)

Offline-first AI coding environment powered by local and cloud LLMs. Built with Electron + React + TypeScript + Vite.

## Features

- **Local LLM Integration** — Powered by **Ollama** (GLM 4.7 Flash default) and **llama.cpp** (Qwen3 Coder 30B). Includes streaming, health checks, and context window auto-reduction.
- **llama.cpp + Qwen3 Coder 30B** — Direct integration with llama-server via OpenAI-compatible API. Launch, monitor, and chat with Qwen3 Coder 30B locally.
- **Cloud Providers** — Support for **OpenAI, Anthropic, Google AI, and Groq** with stored API keys.
- **Monaco Code Editor** — Integrated VS Code editor engine with syntax highlighting, multi-tab support, AI code injection at cursor, and diff/patch application.
- **Command Palette** — Quick file search with Ctrl+P, fuzzy matching across workspace files.
- **Multi-File AI Context** — Include all open editor tabs as context for AI coding requests.
- **Integrated Terminal** — Real PTY-backed terminal (xterm.js + node-pty) with shell selector (PowerShell, CMD, Git Bash, WSL).
- **File Library** — Full file management with drag-and-drop import, Save As, Rename, Move, and Duplicate.
- **AI Coding Pane** — Dedicated AI panel in Code view with modes: **Code, Plan, Build, Bug Fix**. Insert at cursor or replace file.
- **Agent Task System** — Plan/Build/Test pipeline with approval workflow, step tracking, file write diffs, and execution budgets.
- **10 Glassmorphic Themes** — Apple Vision OS inspired design with neon accents and theme-specific agent emojis.
- **Permissions System** — Control AI access to Terminal, File Write, and Code Execution.
- **Runtime Diagnostics** — Live tracking of active AI requests, models, and inference durations.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Ollama](https://ollama.ai/) running locally (for Ollama provider):
  ```bash
  ollama pull glm-4.7-flash
  ollama serve
  ```
- **Optional:** [llama.cpp](https://github.com/ggerganov/llama.cpp) with Qwen3 Coder 30B:
  ```powershell
  cd $env:USERPROFILE\src\llama.cpp\build\bin
  .\llama-server.exe `
    -m "C:\Users\hotre\.lmstudio\models\lmstudio-community\Qwen3-Coder-30B-A3B-Instruct-GGUF\Qwen3-Coder-30B-A3B-Instruct-Q4_K_M.gguf" `
    --ctx-size 65536 `
    --port 8080 `
    --threads 16 `
    --gpu-layers 999
  ```

## Quick Start

```bash
npm install
npm run dev:electron
```

## Build for Production

```bash
npm run build
npm run electron
```

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + 1` | Switch to Chat View |
| `Ctrl + 2` | Switch to Code View |
| `Ctrl + 3` | Switch to File Library |
| `Ctrl + ,` | Open Settings |
| `Ctrl + N` | New Chat / New File |
| `Ctrl + O` | Open File in Editor |
| `Ctrl + P` | Command Palette (Quick Open) |
| `Ctrl + S` | Save Current File |
| `Ctrl + B` | Toggle Sidebar |

## Project Structure

```
src/
├── main/              # Electron main process (Node.js)
│   ├── index.ts       # App entry, lifecycle, window creation
│   ├── ipc.ts         # ALL IPC channel handlers
│   ├── ollama.ts      # Ollama API client (streaming)
│   ├── llamacpp.ts    # llama.cpp / Qwen3 API client (streaming)
│   ├── openai.ts      # OpenAI API client
│   ├── anthropic.ts   # Anthropic API client
│   ├── google.ts      # Google AI API client
│   ├── groq.ts        # Groq API client
│   ├── store.ts       # JSON persistence & File management
│   ├── agent-runner.ts # Agent orchestration (plan/build/test)
│   ├── runtime-diagnostics.ts # Request tracking
│   └── jobs/          # SQLite job queue
├── preload/           # Secure context bridge
│   └── index.ts
└── renderer/          # React frontend (Vite)
    ├── App.tsx        # Root component & State management
    ├── themes.ts      # Theme definitions (10 themes)
    ├── components/    # React components
    │   ├── EditorPane.tsx      # Monaco editor + AI hooks
    │   ├── AIPane.tsx          # AI assistant panel
    │   ├── TerminalPane.tsx    # PTY terminal
    │   ├── CommandPalette.tsx  # Ctrl+P file search
    │   ├── ChatPane.tsx        # Chat interface
    │   ├── SettingsPane.tsx    # Provider config
    │   └── ...
    ├── utils/         # Utilities
    │   └── patchApply.ts  # Unified diff parser
    └── styles/        # Global CSS & Design system
```

## AI Providers

| Provider | Type | Default Model | Status |
|----------|------|---------------|--------|
| Ollama | Local | glm-4.7-flash | Built-in |
| llama.cpp | Local | Qwen3 Coder 30B | Built-in |
| OpenAI | Cloud | gpt-4 | API key required |
| Anthropic | Cloud | claude-3 | API key required |
| Google AI | Cloud | gemini-pro | API key required |
| Groq | Cloud | mixtral | API key required |

## License

MIT License. Built with excellence.
