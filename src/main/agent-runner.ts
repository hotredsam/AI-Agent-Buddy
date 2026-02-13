import { BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs'
import * as path from 'path'
import * as store from './store'
import { generateCodeWithProvider } from './ipc'

export interface AgentTask {
  id: string
  goal: string
  status: 'planning' | 'waiting_approval' | 'approved' | 'running' | 'completed' | 'failed'
  plan: string
  steps: AgentStep[]
  createdAt: string
  currentStepIndex: number
}

export interface AgentStep {
  id: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  result?: string
  command?: string // If the step involves a shell command
  fileEdit?: { path: string; content: string } // If the step involves a file edit
}

const activeTasks = new Map<string, AgentTask>()

function broadcastUpdate() {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send('agent:update', listAgentTasks())
  }
}

function getDocsDir(): string {
  const root = store.getUserFilesPath() // Ideally this should be the workspace root
  const docs = path.join(root, 'docs')
  if (!fs.existsSync(docs)) {
    fs.mkdirSync(docs, { recursive: true })
  }
  return docs
}

export async function createAgentTask(goal: string): Promise<AgentTask> {
  const task: AgentTask = {
    id: uuidv4(),
    goal,
    status: 'planning',
    plan: '',
    steps: [],
    createdAt: new Date().toISOString(),
    currentStepIndex: 0
  }
  activeTasks.set(task.id, task)
  broadcastUpdate()
  
  // Start planning immediately
  planAgentTask(task.id).catch(err => {
    console.error(`[Agent] Planning failed for task ${task.id}:`, err)
    task.status = 'failed'
    broadcastUpdate()
  })

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

export async function approveAgentTask(taskId: string): Promise<AgentTask> {
  const task = activeTasks.get(taskId)
  if (!task) throw new Error('Task not found')
  if (task.status !== 'waiting_approval') throw new Error('Task is not waiting for approval')

  task.status = 'approved'
  broadcastUpdate()
  
  // Trigger execution
  runAgentTask(task.id).catch(err => {
    console.error(`[Agent] Execution failed for task ${task.id}:`, err)
    task.status = 'failed'
    broadcastUpdate()
  })
  
  return task
}

async function planAgentTask(taskId: string): Promise<void> {
  const task = activeTasks.get(taskId)
  if (!task) return

  const settings = store.getSettings()
  
  const prompt = `Goal: ${task.goal}

You are a Senior Technical Planner. Create a detailed, step-by-step implementation plan to achieve this goal.
The plan must be broken down into atomic, executable steps.

Return ONLY a valid JSON object with the following structure:
{
  "planSummary": "Markdown summary of the approach...",
  "steps": [
    { "description": "Step 1 description" },
    { "description": "Step 2 description" }
  ]
}
`

  try {
    // Generate plan using the 'plan' mode system prompt
    const result = await generateCodeWithProvider(settings, prompt, '', undefined, undefined, 'plan')
    
    if (!result.text) {
      throw new Error(result.error || 'Failed to generate plan')
    }

    // Parse JSON (handle potential markdown code blocks)
    let jsonStr = result.text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(json)?/, '').replace(/```$/, '')
    }
    
    const planData = JSON.parse(jsonStr)
    
    task.plan = planData.planSummary
    task.steps = planData.steps.map((s: any) => ({
      id: uuidv4(),
      description: s.description,
      status: 'pending'
    }))
    
    // Write plan to docs
    const docsDir = getDocsDir()
    fs.writeFileSync(path.join(docsDir, 'PLAN.md'), `# Current Plan: ${task.goal}\n\n${task.plan}\n\n## Steps\n${task.steps.map(s => `- [ ] ${s.description}`).join('\n')}`)
    
    task.status = 'waiting_approval'
    broadcastUpdate()
    
  } catch (err) {
    console.error('Planning error:', err)
    task.status = 'failed'
    broadcastUpdate()
  }
}

async function runAgentTask(taskId: string): Promise<void> {
  const task = activeTasks.get(taskId)
  if (!task) return

  task.status = 'running'
  broadcastUpdate()
  
  const settings = store.getSettings()

  for (let i = task.currentStepIndex; i < task.steps.length; i++) {
    const step = task.steps[i]
    step.status = 'in_progress'
    task.currentStepIndex = i
    broadcastUpdate()
    
    try {
      // Execute Step
      // Ideally we loop: Plan Step -> Execute -> Verify -> Commit
      
      const stepPrompt = `Task: ${task.goal}
Current Step: ${step.description}

You are a Build Agent. Implement this step.
If code needs to be written, provide the file path and content.
If a command needs to be run, provide the command.

Return ONLY JSON:
{
  "action": "write_file" | "run_command" | "skip",
  "path": "path/to/file",
  "content": "file content...",
  "command": "shell command..."
}
`
      const result = await generateCodeWithProvider(settings, stepPrompt, '', undefined, undefined, 'build')
      if (result.text) {
         let jsonStr = result.text.trim()
         if (jsonStr.startsWith('```')) {
           jsonStr = jsonStr.replace(/^```(json)?/, '').replace(/```$/, '')
         }
         try {
            const action = JSON.parse(jsonStr)
            
            if (action.action === 'write_file') {
                // Check permissions?
                // For now, write to user-files root
                const fullPath = path.join(store.getUserFilesPath(), action.path)
                const dir = path.dirname(fullPath)
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
                fs.writeFileSync(fullPath, action.content)
                step.result = `Wrote to ${action.path}`
            } else if (action.action === 'run_command') {
                // Execute command (needs IPC call or direct spawn if in main)
                // For safety, maybe just log it for now or use the terminal IPC
                step.result = `Command suggestion: ${action.command}`
            }
         } catch (e) {
             step.result = `Failed to parse action: ${e}`
         }
      }

      step.status = 'completed'
      broadcastUpdate()
    } catch (err) {
      step.status = 'failed'
      task.status = 'failed'
      broadcastUpdate()
      return
    }
  }

  task.status = 'completed'
  broadcastUpdate()
}
