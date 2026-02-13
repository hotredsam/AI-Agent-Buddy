import { BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs'
import * as path from 'path'
import * as store from './store'
import { generateCodeWithProvider } from './ipc'

export type AgentMode = 'plan' | 'build' | 'coding' | 'bugfix'
export type AgentStatus = 'planning' | 'waiting_approval' | 'approved' | 'running' | 'testing' | 'completed' | 'failed' | 'cancelled'
export type AgentPhase = 'idle' | 'thinking' | 'writing' | 'testing' | 'done' | 'error'

export interface AgentTaskCreatePayload {
  goal: string
  mode?: AgentMode
  workspaceRootPath?: string | null
  autoRunPipeline?: boolean
}

export interface AgentStep {
  id: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  result?: string
}

export interface AgentLogEntry {
  id: string
  timestamp: string
  level: 'info' | 'error' | 'stdout' | 'stderr'
  message: string
}

export interface AgentFileWrite {
  id: string
  timestamp: string
  path: string
  bytesBefore: number
  bytesAfter: number
  bytesChanged: number
  preview: string
}

export interface AgentTestRun {
  id: string
  command: string
  exitCode: number
  success: boolean
  output: string
  startedAt: string
  finishedAt: string
}

export interface AgentTask {
  id: string
  goal: string
  mode: AgentMode
  status: AgentStatus
  phase: AgentPhase
  plan: string
  steps: AgentStep[]
  logs: AgentLogEntry[]
  fileWrites: AgentFileWrite[]
  testRuns: AgentTestRun[]
  createdAt: string
  currentStepIndex: number
  workspaceRootPath: string | null
  autoRunPipeline: boolean
  cancelRequested: boolean
  lastError?: string
}

export interface AgentEvent {
  taskId: string
  timestamp: string
  type:
    | 'task_created'
    | 'planning_started'
    | 'plan_generated'
    | 'waiting_approval'
    | 'approved'
    | 'build_started'
    | 'step_started'
    | 'step_completed'
    | 'file_written'
    | 'testing_started'
    | 'test_command_start'
    | 'test_output'
    | 'test_command_complete'
    | 'task_completed'
    | 'task_failed'
    | 'task_cancelled'
    | 'log'
  message?: string
  data?: Record<string, any>
}

const activeTasks = new Map<string, AgentTask>()
const runningCommands = new Map<string, ChildProcess>()
const runningModelRequests = new Map<string, AbortController>()
const MAX_LOG_ENTRIES = 600
const MAX_FILE_WRITES = 200

interface AgentPermissions {
  allowTerminal: boolean
  allowFileWrite: boolean
  allowAICodeExec: boolean
}

function resolveAgentPermissions(settings: store.Settings): AgentPermissions {
  const perms = settings.permissions || {
    allowTerminal: true,
    allowFileWrite: true,
    allowAICodeExec: false,
  }
  return {
    allowTerminal: perms.allowTerminal !== false,
    allowFileWrite: perms.allowFileWrite !== false,
    allowAICodeExec: perms.allowAICodeExec === true,
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function safeWindowSend(win: BrowserWindow, channel: string, payload: any): void {
  try {
    if (win.isDestroyed()) return
    if (win.webContents.isDestroyed()) return
    win.webContents.send(channel, payload)
  } catch {
    // Ignore renderer lifecycle races to keep main process stable.
  }
}

function broadcastUpdate() {
  const tasks = listAgentTasks()
  for (const win of BrowserWindow.getAllWindows()) {
    safeWindowSend(win, 'agent:update', tasks)
  }
}

function broadcastEvent(event: AgentEvent) {
  for (const win of BrowserWindow.getAllWindows()) {
    safeWindowSend(win, 'agent:event', event)
  }
}

function isInsideDir(baseDir: string, targetPath: string): boolean {
  const base = path.resolve(baseDir)
  const target = path.resolve(targetPath)
  return target === base || target.startsWith(base + path.sep)
}

function toRelativePath(baseDir: string, targetPath: string): string {
  return path.relative(baseDir, targetPath).split(path.sep).join('/')
}

function createAutoWorkspaceProject(goal: string): string {
  const baseSlug = goal
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36) || 'agent-project'

  for (let attempt = 0; attempt < 50; attempt++) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`
    const candidateName = `${baseSlug}${suffix}`
    const created = store.createUserProject(candidateName)
    if (created?.isDirectory && created.path) {
      return created.path
    }
  }

  throw new Error('Failed to auto-create workspace project.')
}

function emitEvent(task: AgentTask, type: AgentEvent['type'], message?: string, data?: Record<string, any>) {
  broadcastEvent({
    taskId: task.id,
    timestamp: nowIso(),
    type,
    message,
    data,
  })
}

function appendLog(
  task: AgentTask,
  message: string,
  level: AgentLogEntry['level'] = 'info'
) {
  const entry: AgentLogEntry = {
    id: uuidv4(),
    timestamp: nowIso(),
    level,
    message,
  }
  task.logs.push(entry)
  if (task.logs.length > MAX_LOG_ENTRIES) {
    task.logs.splice(0, task.logs.length - MAX_LOG_ENTRIES)
  }
  emitEvent(task, 'log', message, { level, log: entry })
  broadcastUpdate()
}

function setTaskPhase(task: AgentTask, phase: AgentPhase) {
  task.phase = phase
  broadcastUpdate()
}

function parseJsonBlock(rawText: string): any | null {
  const trimmed = rawText.trim()
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed
  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

function buildFallbackPlan(rawText: string): { planSummary: string; steps: Array<{ description: string }> } {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const bulletLines = lines
    .map((line) => line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''))
    .filter((line) => line.length > 0)

  const stepCandidates = bulletLines.slice(0, 8)
  const steps = stepCandidates.length > 0
    ? stepCandidates.map((description) => ({ description }))
    : [{ description: 'Implement requested changes in the workspace.' }]

  return {
    planSummary: rawText.trim() || 'Generated fallback plan.',
    steps,
  }
}

function getDiffPreview(before: string, after: string): string {
  const beforeLines = before.split(/\r?\n/)
  const afterLines = after.split(/\r?\n/)
  const maxLines = Math.max(beforeLines.length, afterLines.length)
  const changed: string[] = []
  const limit = 12

  for (let i = 0; i < maxLines; i++) {
    const left = beforeLines[i] ?? ''
    const right = afterLines[i] ?? ''
    if (left === right) continue
    changed.push(`L${i + 1} - ${left}`)
    changed.push(`L${i + 1} + ${right}`)
    if (changed.length >= limit) break
  }

  if (changed.length === 0) {
    return 'No line-level text changes detected.'
  }

  if (changed.length >= limit && maxLines > limit / 2) {
    changed.push('...')
  }

  return changed.join('\n')
}

function resolveWorkspaceWritePath(workspaceRoot: string, requestedPath: string): string {
  const root = path.resolve(workspaceRoot)
  const target = path.resolve(root, requestedPath)
  if (!isInsideDir(root, target)) {
    throw new Error('Security Error: Cannot write outside workspace root.')
  }
  return target
}

function parseAction(rawText: string): {
  action: 'write_file' | 'run_command' | 'skip'
  path?: string
  content?: string
  command?: string
} {
  const parsed = parseJsonBlock(rawText)
  if (!parsed || typeof parsed !== 'object') {
    return { action: 'skip' }
  }

  const action = parsed.action
  if (action === 'write_file') {
    return {
      action: 'write_file',
      path: typeof parsed.path === 'string' ? parsed.path : '',
      content: typeof parsed.content === 'string' ? parsed.content : '',
    }
  }
  if (action === 'run_command') {
    return {
      action: 'run_command',
      command: typeof parsed.command === 'string' ? parsed.command : '',
    }
  }
  return { action: 'skip' }
}

function writeWorkspaceFile(task: AgentTask, relativePath: string, content: string): AgentFileWrite {
  const workspaceRoot = task.workspaceRootPath
  if (!workspaceRoot) {
    throw new Error('Open a project first.')
  }

  const absolutePath = resolveWorkspaceWritePath(workspaceRoot, relativePath)
  const before = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf-8') : ''
  const bytesBefore = Buffer.byteLength(before)
  const bytesAfter = Buffer.byteLength(content)

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  fs.writeFileSync(absolutePath, content, 'utf-8')

  const write: AgentFileWrite = {
    id: uuidv4(),
    timestamp: nowIso(),
    path: toRelativePath(workspaceRoot, absolutePath),
    bytesBefore,
    bytesAfter,
    bytesChanged: bytesAfter - bytesBefore,
    preview: getDiffPreview(before, content),
  }

  task.fileWrites.push(write)
  if (task.fileWrites.length > MAX_FILE_WRITES) {
    task.fileWrites.splice(0, task.fileWrites.length - MAX_FILE_WRITES)
  }

  appendLog(
    task,
    `[write] ${write.timestamp} ${write.path} (delta ${write.bytesChanged >= 0 ? '+' : ''}${write.bytesChanged} bytes)`
  )
  emitEvent(task, 'file_written', `Wrote ${write.path}`, { write })
  return write
}

function readPackageTestScript(workspaceRoot: string): string | null {
  const packageJsonPath = path.join(workspaceRoot, 'package.json')
  if (!fs.existsSync(packageJsonPath)) return null
  try {
    const parsed = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    const testScript = parsed?.scripts?.test
    return typeof testScript === 'string' && testScript.trim() ? testScript : null
  } catch {
    return null
  }
}

async function runCommand(
  task: AgentTask,
  command: string,
  cwd: string
): Promise<AgentTestRun> {
  const startedAt = nowIso()
  emitEvent(task, 'test_command_start', `Running: ${command}`, { command })
  appendLog(task, `[test] ${command}`)

  return new Promise<AgentTestRun>((resolve, reject) => {
    let output = ''
    const child = spawn(command, {
      cwd,
      shell: true,
      env: process.env,
    })

    runningCommands.set(task.id, child)

    child.stdout?.on('data', (chunk: Buffer | string) => {
      const text = chunk.toString()
      output += text
      emitEvent(task, 'test_output', undefined, { command, stream: 'stdout', text })
      appendLog(task, text, 'stdout')
    })

    child.stderr?.on('data', (chunk: Buffer | string) => {
      const text = chunk.toString()
      output += text
      emitEvent(task, 'test_output', undefined, { command, stream: 'stderr', text })
      appendLog(task, text, 'stderr')
    })

    child.on('error', (error) => {
      runningCommands.delete(task.id)
      reject(error)
    })

    child.on('close', (code) => {
      runningCommands.delete(task.id)
      const finishedAt = nowIso()
      const exitCode = code ?? 1
      const run: AgentTestRun = {
        id: uuidv4(),
        command,
        exitCode,
        success: exitCode === 0,
        output,
        startedAt,
        finishedAt,
      }
      emitEvent(task, 'test_command_complete', `${command} exited with code ${exitCode}`, { run })
      resolve(run)
    })
  })
}

function failTask(task: AgentTask, error: unknown, prefix: string) {
  runningModelRequests.delete(task.id)
  const message = error instanceof Error ? error.message : String(error)
  task.status = 'failed'
  task.phase = 'error'
  task.lastError = `${prefix}: ${message}`
  appendLog(task, task.lastError, 'error')
  emitEvent(task, 'task_failed', task.lastError)
  broadcastUpdate()
}

export function listAgentTasks(): AgentTask[] {
  return Array.from(activeTasks.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function getAgentTask(id: string): AgentTask | undefined {
  return activeTasks.get(id)
}

export async function createAgentTask(input: string | AgentTaskCreatePayload): Promise<AgentTask> {
  const payload: AgentTaskCreatePayload = typeof input === 'string'
    ? { goal: input }
    : input

  const goal = payload.goal?.trim()
  if (!goal) {
    throw new Error('Goal is required.')
  }

  const task: AgentTask = {
    id: uuidv4(),
    goal,
    mode: payload.mode || 'plan',
    status: 'planning',
    phase: 'thinking',
    plan: '',
    steps: [],
    logs: [],
    fileWrites: [],
    testRuns: [],
    createdAt: nowIso(),
    currentStepIndex: 0,
    workspaceRootPath: payload.workspaceRootPath || null,
    autoRunPipeline: payload.autoRunPipeline ?? true,
    cancelRequested: false,
  }

  activeTasks.set(task.id, task)
  emitEvent(task, 'task_created', `Task created (${task.mode}): ${task.goal}`, {
    mode: task.mode,
    workspaceRootPath: task.workspaceRootPath,
    autoRunPipeline: task.autoRunPipeline,
  })
  appendLog(task, `Task created in ${task.mode} mode.`)
  broadcastUpdate()

  planAgentTask(task.id).catch((error) => {
    failTask(task, error, 'Planning failed')
  })

  return task
}

export async function approveAgentTask(taskId: string, workspaceRootPath?: string | null): Promise<AgentTask> {
  const task = activeTasks.get(taskId)
  if (!task) throw new Error('Task not found.')
  if (task.status !== 'waiting_approval') throw new Error('Task is not waiting for approval.')
  if (task.cancelRequested) throw new Error('Task has been cancelled.')

  if (workspaceRootPath && workspaceRootPath.trim()) {
    const resolved = path.resolve(workspaceRootPath)
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new Error('Selected workspace folder is not available.')
    }
    task.workspaceRootPath = resolved
  }

  if (!task.workspaceRootPath && task.mode === 'plan') {
    const autoWorkspace = createAutoWorkspaceProject(task.goal)
    task.workspaceRootPath = path.resolve(autoWorkspace)
    appendLog(task, `Auto-created workspace project: ${task.workspaceRootPath}`)
  }

  if (task.mode !== 'plan' && !task.workspaceRootPath) {
    throw new Error('Open a project first.')
  }

  task.status = 'approved'
  emitEvent(task, 'approved', 'Plan approved.')
  appendLog(task, 'Plan approved by user.')
  broadcastUpdate()

  runAgentTask(task.id).catch((error) => {
    failTask(task, error, 'Execution failed')
  })

  return task
}

export async function cancelAgentTask(taskId: string): Promise<AgentTask> {
  const task = activeTasks.get(taskId)
  if (!task) throw new Error('Task not found.')

  task.cancelRequested = true
  if (!['completed', 'failed', 'cancelled'].includes(task.status)) {
    task.status = 'cancelled'
    task.phase = 'done'
  }

  const running = runningCommands.get(task.id)
  if (running) {
    try {
      running.kill()
    } catch {
      // ignore kill errors
    }
    runningCommands.delete(task.id)
  }

  const pendingModel = runningModelRequests.get(task.id)
  if (pendingModel) {
    pendingModel.abort()
    runningModelRequests.delete(task.id)
  }

  appendLog(task, 'Task cancelled by user.')
  emitEvent(task, 'task_cancelled', 'Task cancelled by user.')
  broadcastUpdate()
  return task
}

async function planAgentTask(taskId: string): Promise<void> {
  const task = activeTasks.get(taskId)
  if (!task || task.cancelRequested) return

  task.status = 'planning'
  setTaskPhase(task, 'thinking')
  emitEvent(task, 'planning_started', 'Generating plan...')
  appendLog(task, 'Planning started.')

  const settings = store.getSettings()
  const prompt = [
    `Goal: ${task.goal}`,
    '',
    'Create an implementation plan as strict JSON.',
    'Return ONLY:',
    '{',
    '  "planSummary": "Short markdown summary",',
    '  "steps": [{ "description": "Atomic step" }]',
    '}',
  ].join('\n')

  const plannerController = new AbortController()
  runningModelRequests.set(task.id, plannerController)
  let result: { text: string | null; error?: string }
  try {
    result = await generateCodeWithProvider(
      settings,
      prompt,
      '',
      undefined,
      undefined,
      'plan',
      plannerController.signal
    )
  } finally {
    runningModelRequests.delete(task.id)
  }

  if (!result.text) {
    throw new Error(result.error || 'Planner returned empty output.')
  }

  if (task.cancelRequested) {
    task.status = 'cancelled'
    task.phase = 'done'
    emitEvent(task, 'task_cancelled', 'Task cancelled while planning.')
    broadcastUpdate()
    return
  }

  setTaskPhase(task, 'writing')

  const parsed = parseJsonBlock(result.text)
  const fallback = buildFallbackPlan(result.text)
  const planSummary = typeof parsed?.planSummary === 'string'
    ? parsed.planSummary
    : fallback.planSummary
  const stepsArray = Array.isArray(parsed?.steps) ? parsed.steps : fallback.steps

  task.plan = planSummary
  task.steps = stepsArray.map((step: any) => ({
    id: uuidv4(),
    description: String(step?.description || 'Follow-up implementation step'),
    status: 'pending',
  }))

  task.status = 'waiting_approval'
  task.phase = 'done'
  emitEvent(task, 'plan_generated', `Plan generated with ${task.steps.length} steps.`, {
    plan: task.plan,
    steps: task.steps,
  })
  emitEvent(task, 'waiting_approval', 'Waiting for approval.')
  appendLog(task, `Plan generated with ${task.steps.length} steps.`)
  broadcastUpdate()
}

async function runAgentTask(taskId: string): Promise<void> {
  const task = activeTasks.get(taskId)
  if (!task || task.cancelRequested) return

  const shouldExecuteBuild =
    task.mode === 'plan' ||
    task.mode === 'build' ||
    task.mode === 'bugfix'

  if (!shouldExecuteBuild) {
    task.status = 'completed'
    task.phase = 'done'
    appendLog(task, 'Plan mode complete.')
    emitEvent(task, 'task_completed', 'Plan approved and finalized.')
    broadcastUpdate()
    return
  }

  if (!task.workspaceRootPath) {
    throw new Error('Open a project first.')
  }

  const workspaceRoot = path.resolve(task.workspaceRootPath)
  if (!fs.existsSync(workspaceRoot) || !fs.statSync(workspaceRoot).isDirectory()) {
    throw new Error('Workspace root is not available.')
  }

  task.workspaceRootPath = workspaceRoot
  task.status = 'running'
  setTaskPhase(task, 'writing')
  if (task.mode === 'plan') {
    appendLog(task, 'Plan approved. Continuing into build workflow.')
  }
  emitEvent(task, 'build_started', `Running build workflow in ${workspaceRoot}.`, {
    workspaceRootPath: workspaceRoot,
  })
  appendLog(task, `Build started in workspace: ${workspaceRoot}`)

  const settings = store.getSettings()
  const permissions = resolveAgentPermissions(settings)

  for (let i = task.currentStepIndex; i < task.steps.length; i++) {
    if (task.cancelRequested) {
      task.status = 'cancelled'
      task.phase = 'done'
      emitEvent(task, 'task_cancelled', 'Task cancelled during step execution.')
      broadcastUpdate()
      return
    }

    const step = task.steps[i]
    task.currentStepIndex = i
    step.status = 'in_progress'
    emitEvent(task, 'step_started', `Step ${i + 1}: ${step.description}`, {
      stepId: step.id,
      index: i,
      description: step.description,
    })
    appendLog(task, `Step ${i + 1} started: ${step.description}`)
    broadcastUpdate()

    try {
      setTaskPhase(task, 'thinking')
      const stepPrompt = [
        `Task goal: ${task.goal}`,
        `Workspace root: ${workspaceRoot}`,
        `Current step: ${step.description}`,
        '',
        'Return ONLY JSON:',
        '{',
        '  "action": "write_file" | "run_command" | "skip",',
        '  "path": "relative/path/from/workspace/root",',
        '  "content": "file content when writing",',
        '  "command": "command when run_command"',
        '}',
      ].join('\n')

      const stepController = new AbortController()
      runningModelRequests.set(task.id, stepController)
      let result: { text: string | null; error?: string }
      try {
        result = await generateCodeWithProvider(
          settings,
          stepPrompt,
          '',
          undefined,
          undefined,
          task.mode === 'bugfix' ? 'bugfix' : 'build',
          stepController.signal
        )
      } finally {
        runningModelRequests.delete(task.id)
      }

      if (!result.text) {
        throw new Error(result.error || 'Empty step output.')
      }

      setTaskPhase(task, 'writing')
      const action = parseAction(result.text)

      if (action.action === 'write_file') {
        if (!permissions.allowFileWrite) {
          throw new Error('Agent file writes are disabled. Enable "Allow agent file writes" in Settings.')
        }
        if (!action.path || typeof action.content !== 'string') {
          throw new Error('Invalid write_file payload from model.')
        }
        writeWorkspaceFile(task, action.path, action.content)
        step.result = `Wrote ${action.path}`
      } else if (action.action === 'run_command') {
        const command = action.command?.trim() || '(empty command)'
        if (!permissions.allowTerminal) {
          throw new Error('Agent command execution is disabled. Enable "Allow agent to run commands" in Settings.')
        }
        const run = await runCommand(task, command, workspaceRoot)
        task.testRuns.push(run)
        if (!run.success) {
          throw new Error(`Command failed: ${command} (exit ${run.exitCode})`)
        }
        step.result = `Executed command: ${command}`
        appendLog(task, `Command executed successfully: ${command}`)
      } else {
        step.result = 'Skipped by model.'
        appendLog(task, 'Step skipped by model output.')
      }

      step.status = 'completed'
      emitEvent(task, 'step_completed', `Step ${i + 1} completed.`, {
        stepId: step.id,
        result: step.result,
      })
      broadcastUpdate()
    } catch (error) {
      step.status = 'failed'
      step.result = error instanceof Error ? error.message : String(error)
      throw error
    }
  }

  if (task.autoRunPipeline) {
    if (!permissions.allowTerminal) {
      throw new Error('Agent command execution is disabled. Enable "Allow agent to run commands" in Settings.')
    }

    task.status = 'testing'
    setTaskPhase(task, 'testing')
    emitEvent(task, 'testing_started', 'Running validation commands.')
    appendLog(task, 'Testing phase started.')
    broadcastUpdate()

    const commands = ['npm run build', 'npx tsc --noEmit']
    if (readPackageTestScript(workspaceRoot)) {
      commands.push('npm test')
    }

    for (const command of commands) {
      if (task.cancelRequested) {
        task.status = 'cancelled'
        task.phase = 'done'
        emitEvent(task, 'task_cancelled', 'Task cancelled during testing.')
        broadcastUpdate()
        return
      }

      const run = await runCommand(task, command, workspaceRoot)
      task.testRuns.push(run)
      if (!run.success) {
        throw new Error(`Test command failed: ${command} (exit ${run.exitCode})`)
      }
      broadcastUpdate()
    }
    appendLog(task, 'All test commands passed.')
  }

  task.status = 'completed'
  task.phase = 'done'
  emitEvent(task, 'task_completed', 'Task completed successfully.', {
    fileWrites: task.fileWrites.length,
    testsRun: task.testRuns.length,
  })
  appendLog(task, 'Task completed successfully.')
  broadcastUpdate()
}

export function createAgentTaskFixtureForTest(input: Partial<AgentTask> & { goal?: string } = {}): AgentTask {
  const now = nowIso()
  const task: AgentTask = {
    id: input.id || uuidv4(),
    goal: input.goal || 'Test fixture task',
    mode: input.mode || 'plan',
    status: input.status || 'waiting_approval',
    phase: input.phase || 'done',
    plan: input.plan || '1. Fixture plan',
    steps: input.steps || [
      {
        id: uuidv4(),
        description: 'Fixture step',
        status: 'pending',
      },
    ],
    logs: input.logs || [],
    fileWrites: input.fileWrites || [],
    testRuns: input.testRuns || [],
    createdAt: input.createdAt || now,
    currentStepIndex: input.currentStepIndex || 0,
    workspaceRootPath: input.workspaceRootPath ?? null,
    autoRunPipeline: input.autoRunPipeline ?? true,
    cancelRequested: input.cancelRequested ?? false,
    lastError: input.lastError,
  }

  activeTasks.set(task.id, task)
  broadcastUpdate()
  return task
}

export function clearAgentTasksForTest(): void {
  activeTasks.clear()
  runningModelRequests.clear()
  broadcastUpdate()
}
