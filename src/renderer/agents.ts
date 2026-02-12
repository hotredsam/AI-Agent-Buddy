/**
 * Agent Configuration - Simple agent system for AI IDE
 * Agents can review code, suggest improvements, run tasks
 */

export interface AgentConfig {
  id: string
  name: string
  type: 'local-coding' | 'cloud-reasoning' | 'qa-refactor'
  description: string
  model: string
  enabled: boolean
  systemPrompt: string
  temperature: number
}

export const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: 'local-coder',
    name: 'Local Coding Agent',
    type: 'local-coding',
    description: 'Uses GLM via Ollama for code generation, explanation, and modification',
    model: 'glm-4.7-flash',
    enabled: true,
    systemPrompt: 'You are a helpful coding assistant. Be concise and provide working code.',
    temperature: 0.3,
  },
  {
    id: 'cloud-reasoner',
    name: 'Cloud Reasoning Agent',
    type: 'cloud-reasoning',
    description: 'Optional cloud fallback for complex reasoning tasks (requires API key)',
    model: 'auto',
    enabled: false,
    systemPrompt: 'You are an expert software architect. Analyze problems deeply.',
    temperature: 0.5,
  },
  {
    id: 'qa-agent',
    name: 'QA / Refactor Agent',
    type: 'qa-refactor',
    description: 'Reviews code changes, suggests improvements, checks for bugs',
    model: 'glm-4.7-flash',
    enabled: true,
    systemPrompt: 'You are a QA engineer. Review code for bugs, suggest improvements, and ensure quality.',
    temperature: 0.2,
  },
]

/**
 * Generates a cloud checkpoint prompt for Codex/Claude review.
 * This minimizes expensive cloud usage by creating a structured summary.
 */
export function generateCloudCheckpointPrompt(projectInfo: {
  fileCount: number
  conversationCount: number
  settings: any
  recentErrors: string[]
}): string {
  return `# Cloud Checkpoint — AI Agent IDE

## Project Status
- Files in library: ${projectInfo.fileCount}
- Active conversations: ${projectInfo.conversationCount}
- Model: ${projectInfo.settings?.modelName || 'unknown'}
- Context window: ${projectInfo.settings?.numCtx || 'unknown'}
- Theme: ${projectInfo.settings?.theme || 'unknown'}

## Architecture
- Electron + React + TypeScript + Vite
- Main process: IPC handlers, Ollama API client, JSON persistence
- Renderer: React chat UI, settings, file manager, themes
- Ollama integration: streaming, context fallback, diagnostics

## Current Capabilities
- Chat with local LLM (streaming)
- Conversation management (CRUD)
- User file library (import, delete, browse)
- 10 theme system
- Ollama diagnostics (preflight, model check)
- Keyboard shortcuts (Ctrl+N, Ctrl+1/2, Ctrl+,)

## Known Issues / Recent Errors
${projectInfo.recentErrors.length > 0 ? projectInfo.recentErrors.map(e => '- ' + e).join('\n') : '- None recorded'}

## Suggested Next Steps
1. Add Monaco code editor for file editing
2. Add terminal panel for command execution
3. Implement agent orchestration (sequential/parallel tasks)
4. Add conversation export/import
5. Token usage tracking
6. GPU memory indicator

## Review Request
Please review the architecture and suggest optimizations for:
- Performance (startup time, memory usage)
- Code quality (type safety, error handling)
- Feature completeness for an offline-first AI IDE
`
}
