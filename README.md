# AI Agent IDE (AI Agent Buddy)

Offline-first AI coding environment powered by local and cloud LLMs. Built with Electron + React + TypeScript + Vite.

## Features

- **Local LLM Integration** — Powered by **Ollama** (GLM 4.7 Flash default). Includes streaming, health checks, and context window auto-reduction.
- **Cloud Providers** — Support for **OpenAI, Anthropic, Google AI, and Groq** with stored API keys.
- **Monaco Code Editor** — Integrated VS Code editor engine with syntax highlighting, multi-tab support, and AI code injection.
- **Integrated Terminal** — Real PTY-backed terminal (xterm.js + node-pty) for interactive shell support.
- **File Library** — OneDrive-style file management with drag-and-drop import, Save As, Rename, Move, and Duplicate.
- **AI Coding Pane** — Dedicated AI panel in Code view with specialized modes: **Code, Plan, Build, Bug Fix**.
- **10 Glassmorphic Themes** — Beautiful Apple Vision OS inspired design with neon accents and theme-specific agent emojis.
- **Permissions System** — Control AI access to Terminal, File Write, and Code Execution for security.
- **Keyboard Shortcuts** — Full set of productivity shortcuts (Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+1/2/3, etc.).

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Ollama](https://ollama.ai/) running locally:
  ```bash
  ollama pull glm-4.7-flash
  ollama serve
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
| `Ctrl + S` | Save Current File |
| `Ctrl + B` | Toggle Sidebar |
| `Ctrl + P` | Quick Open File |

## Project Structure

```
src/
├── main/           # Electron main process (Node.js)
│   ├── index.ts    # App entry, lifecycle, window creation
│   ├── ipc.ts      # ALL IPC channel handlers
│   ├── ollama.ts   # Ollama API client (streaming)
│   ├── store.ts    # JSON persistence & File management
│   └── ...         # Cloud provider clients (openai, anthropic, etc)
├── preload/        # Context bridge
│   └── index.ts
└── renderer/       # React frontend (Vite)
    ├── App.tsx     # Root component & State management
    ├── themes.ts   # Theme definitions (10 themes)
    ├── components/ # React components (Editor, Terminal, Chat, etc)
    └── styles/     # Global CSS & Design system
```

## License

MIT License. Built with excellence.
