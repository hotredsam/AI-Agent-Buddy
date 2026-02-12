import { BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import * as store from './store'
import { generateCodeWithProvider } from './ipc' // We'll export this from IPC or move it to a shared helper

export interface AgentTask {
  id: string
  goal: string
  status: 'planning' | 'ready' | 'running' | 'completed' | 'failed'
  plan: string
  steps: AgentStep[]
  createdAt: string
}

export interface AgentStep {
  id: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  result?: string
}

const activeTasks = new Map<string, AgentTask>()

export async function createAgentTask(goal: string): Promise<AgentTask> {
  const task: AgentTask = {
    id: uuidv4(),
    goal,
    status: 'planning',
    plan: '',
    steps: [],
    createdAt: new Date().toISOString()
  }
  activeTasks.set(task.id, task)
  return task
}

export function getAgentTask(id: string): AgentTask | undefined {
  return activeTasks.get(id)
}

export function listAgentTasks(): AgentTask[] {
  return Array.from(activeTasks.values()).sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export async function planAgentTask(taskId: string): Promise<AgentTask> {
  const task = activeTasks.get(taskId)
  if (!task) throw new Error('Task not found')

  const settings = store.getSettings()
  
  // 1. Generate Plan
  const prompt = `Goal: ${task.goal}

Create a concise, step-by-step implementation plan. Return ONLY a JSON array of strings, e.g. ["Create file X", "Implement function Y"]. Do not include markdown formatting.`
  
  // We need to access the generate function. 
  // Refactoring note: Ideally 'generateCodeWithProvider' should be in a separate 'ai-service.ts' file to avoid circular deps with ipc.ts.
  // For now, we will assume it is exported or we replicate the call.
  // I will refactor ipc.ts to export the generator logic.
  
  return task
}
