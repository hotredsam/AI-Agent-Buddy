# AI Agent IDE

Offline ChatGPT-style desktop assistant powered by local LLMs via Ollama. Built with Electron + React + TypeScript.

## Features

- **Chat UI** — Sidebar conversation list, message bubbles, streaming responses
- **Local LLM** — Ollama integration with GLM 4.7 Flash (128k context with auto-fallback)
- **Conversation Management** — Create, rename, delete conversations
- **Settings** — Configure Ollama endpoint, model name, context window size
- **Offline-First** — All data stored locally as JSON files
- **Workspace Tab** — Placeholder for future IDE features

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Ollama](https://ollama.ai/) running locally with GLM 4.7 Flash:
  ```bash
  ollama pull glm-4.7-flash
  ollama serve
  ```

## Quick Start

```bash
npm install
npm run dev:electron
```

This builds the main process + preload, starts Vite dev server, and launches Electron.

## Build for Production

```bash
npm run build
npm run electron
```

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── index.ts    # App entry, window creation
│   ├── ipc.ts      # IPC channel handlers
│   ├── ollama.ts   # Ollama API client (streaming)
│   └── store.ts    # JSON file persistence
├── preload/        # Context bridge (IPC to renderer)
│   └── index.ts
└── renderer/       # React frontend
    ├── App.tsx     # Root component
    ├── components/ # UI components
    ├── styles/     # CSS
    └── types.ts    # TypeScript interfaces
```

## IPC Channels

| Channel | Description |
|---|---|
| `chat:listConversations` | List all conversations |
| `chat:createConversation` | Create new conversation |
| `chat:deleteConversation` | Delete conversation by ID |
| `chat:renameConversation` | Rename conversation |
| `chat:listMessages` | Get messages for conversation |
| `chat:sendMessage` | Send message + stream response |
| `settings:get` | Get app settings |
| `settings:set` | Update app settings |
| `ollama:health` | Check Ollama connection |

## Codex Check-Ins

Run periodic code reviews using ChatGPT Codex exec:

```powershell
.\scripts\codex_checkin.ps1
```

See `docs/CODEX_CHECKIN_PROMPT.md` for the review prompt.

## Next Steps

See `docs/CURSOR_NEXT_PROMPT.md` for continuation prompts to guide further development.

## Attribution

Built as a minimal MVP. Scaffold generated with Claude Code assistance. MIT License.
