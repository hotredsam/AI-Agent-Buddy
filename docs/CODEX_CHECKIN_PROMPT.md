# Codex Exec Check-In Prompt

Use this prompt with ChatGPT Codex exec to review the AI Agent IDE repo.

---

## Prompt

```
You are reviewing an Electron + React + TypeScript MVP desktop app called "AI Agent IDE".

Repository structure:
- src/main/ — Electron main process (IPC handlers, Ollama API, JSON store)
- src/preload/ — Context bridge for IPC
- src/renderer/ — React UI (chat, settings, workspace placeholder)
- scripts/ — Dev tooling
- docs/ — Documentation

Please perform the following checks:

1. **Build Health**: Can the project build cleanly with `npm run build`?
2. **Type Safety**: Are there any TypeScript errors or `any` type leaks in the IPC bridge?
3. **Security**: Is contextIsolation enabled? Is nodeIntegration disabled? Any XSS vectors in message rendering?
4. **Streaming Correctness**: Does the Ollama streaming flow (main → preload → renderer) handle errors and partial responses correctly?
5. **Data Persistence**: Are conversations and messages stored reliably? Any race conditions in JSON file writes?
6. **UI Completeness**: Do all sidebar actions (new chat, rename, delete) work? Does the settings pane save correctly?
7. **Context Window Fallback**: Does the Ollama integration properly detect and fall back from 128k context to smaller windows?
8. **Dead Code**: Any unused imports, unreachable code, or leftover scaffolding?

Output a brief report with:
- PASS / WARN / FAIL per check
- Specific file:line references for any issues
- Suggested fixes (1-2 lines each)
```

---

## When to Run

- After any major feature addition
- Before packaging for distribution
- After refactoring IPC or store logic
- Weekly during active development
