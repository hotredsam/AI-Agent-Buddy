import { _electron as electron, test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

async function captureScreenshot(window: any, fileName: string) {
  const outDir = path.join(__dirname, '..', 'test-results', 'screenshots');
  fs.mkdirSync(outDir, { recursive: true });
  await window.screenshot({
    path: path.join(outDir, fileName),
    fullPage: false,
  });
}

test.describe('Application Launch', () => {
  let app: any;

  test.beforeEach(async () => {
    // Launch the electron app from the root
    app = await electron.launch({
      args: [path.join(__dirname, '..')],
      env: { ...process.env, NODE_ENV: 'test' }
    });
  });

  test.afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  test('shows the initial window', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    
    // Check title (though we use a custom titlebar, the window title might still be set)
    // Or check for a key element
    const sidebar = await window.locator('.sidebar');
    await expect(sidebar).toBeVisible();
    
    const chatPane = await window.locator('.chat-pane');
    await expect(chatPane).toBeVisible();
  });

  test('can switch views', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Click Code button
    await window.locator('button[title="Code Editor"]').click();
    await expect(window.locator('.code-layout')).toBeVisible();

    // Click Files button
    await window.locator('button[title="Files"]').click();
    await expect(window.locator('.workspace-pane-container')).toBeVisible();

    // Click Settings button
    await window.locator('button[title="Settings"]').click();
    await expect(window.locator('.settings-pane')).toBeVisible();
  });

  test('chat composer works', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    const textarea = window.locator('.composer-textarea');
    await textarea.fill('Hello, AI Agent!');
    await expect(textarea).toHaveValue('Hello, AI Agent!');
    
    // Check if send button is enabled
    const sendBtn = window.locator('.composer-send-btn');
    await expect(sendBtn).not.toBeDisabled();
  });

  test('chat shows thinking lifecycle state when request starts', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.evaluate(() => {
      const original = window.electronAPI.sendMessage;
      window.electronAPI.sendMessage = (() => Promise.resolve()) as typeof original;
    });

    const textarea = window.locator('.composer-textarea');
    await textarea.fill('Test lifecycle state');
    await textarea.press('Enter');

    await expect(window.locator('.streaming-badge.lifecycle-thinking')).toBeVisible();
  });

  test('editor can create new file', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.locator('button[title="Code Editor"]').click();
    
    // Welcome screen should be visible
    const welcome = window.locator('.editor-welcome');
    await expect(welcome).toBeVisible();

    // Click "New File" in welcome screen
    await window.locator('button:has-text("New File...")').click();

    // Editor should be visible
    await expect(window.locator('.editor-monaco')).toBeVisible();
    
    // Tab should be created
    const tab = window.locator('.editor-tab.active');
    await expect(tab).toBeVisible();
    await expect(tab).toContainText('untitled-1.txt');
  });

  test('terminal is accessible', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.locator('button[title="Code Editor"]').click();
    
    // Terminal should be visible by default in code view
    const terminal = window.locator('.terminal-pane');
    await expect(terminal).toBeVisible();
    
    // Check for xterm container
    const xterm = window.locator('.terminal-xterm-container');
    await expect(xterm).toBeVisible();
  });

  test('code view shows right-side ai pane', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.locator('button[title="Code Editor"]').click();
    await expect(window.locator('.ai-pane')).toBeVisible();
    await expect(window.locator('.ai-pane-input')).toBeVisible();
  });

  test('ai pane keeps input near bottom', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.locator('button[title="Code Editor"]').click();

    await expect.poll(async () => {
      return await window.evaluate(() => {
        const pane = document.querySelector('.ai-pane');
        const input = document.querySelector('.ai-pane-input');
        if (!pane || !input) return false;
        const paneRect = pane.getBoundingClientRect();
        const inputRect = input.getBoundingClientRect();
        return inputRect.bottom > paneRect.bottom - 180;
      });
    }).toBeTruthy();
  });

  test('ai pane mode dropdown has readable contrast', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.locator('button[title="Code Editor"]').click();

    const contrastOk = await window.evaluate(() => {
      const select = document.querySelector('.ai-pane-select') as HTMLSelectElement | null;
      if (!select) return false;
      const style = getComputedStyle(select);
      const bg = style.backgroundColor.replace(/\s+/g, '');
      const fg = style.color.replace(/\s+/g, '');
      return bg !== fg && bg !== 'rgba(0,0,0,0)' && fg !== 'rgba(0,0,0,0)';
    });
    expect(contrastOk).toBeTruthy();
  });

  test('approve button invokes approval flow from plan state', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    const workspacePath = await window.evaluate(async () => {
      const projectName = `ApproveFlowWorkspace-${Date.now()}`;
      const created = await window.electronAPI.createProject(projectName);
      return created?.path || null;
    });
    expect(workspacePath).toBeTruthy();

    await window.evaluate(async (workspaceRootPath) => {
      const now = new Date().toISOString();
      await window.electronAPI.testClearAgentTasks();
      await window.electronAPI.testCreateAgentTaskFixture({
        id: 'fake-plan-task',
        goal: 'fake goal',
        mode: 'plan',
        status: 'waiting_approval',
        phase: 'done',
        plan: '1. fake plan',
        steps: [],
        logs: [],
        fileWrites: [],
        testRuns: [],
        createdAt: now,
        currentStepIndex: 0,
        workspaceRootPath,
        autoRunPipeline: false,
        cancelRequested: false,
      });
    }, workspacePath);

    await window.locator('button[title="Code Editor"]').click();
    await expect(window.locator('button:has-text("Approve Plan")')).toBeEnabled();
    await window.locator('button:has-text("Approve Plan")').click();

    await expect.poll(async () => {
      return await window.evaluate(async () => {
        const tasks = await window.electronAPI.listAgentTasks();
        const task = tasks.find((t) => t.id === 'fake-plan-task');
        return task?.status || 'missing';
      });
    }).not.toBe('waiting_approval');
  });

  test('window maximize can restore back down', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    const before = await window.evaluate(async () => {
      return await window.electronAPI.windowIsMaximized();
    });
    expect(before).toBeFalsy();

    const afterMax = await window.evaluate(async () => {
      await window.electronAPI.windowMaximize();
      return await window.electronAPI.windowIsMaximized();
    });
    expect(afterMax).toBeTruthy();

    const afterRestore = await window.evaluate(async () => {
      await window.electronAPI.windowMaximize();
      return await window.electronAPI.windowIsMaximized();
    });
    expect(afterRestore).toBeFalsy();
  });

  test('sidebar collapsed nav is vertically stacked', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.locator('button[title="Collapse sidebar"]').click();
    const isVertical = await window.evaluate(() => {
      const nav = document.querySelector('.sidebar.collapsed .sidebar-nav');
      if (!nav) return false;
      return getComputedStyle(nav).flexDirection === 'column';
    });
    expect(isVertical).toBeTruthy();
  });

  test('terminal supports shell selector, tabs, and split', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.locator('button[title="Code Editor"]').click();

    await expect(window.locator('.terminal-shell-select')).toBeVisible();
    const initialTabs = await window.locator('.terminal-tab').count();
    await window.locator('button[title="New terminal"]').click();
    await expect.poll(async () => await window.locator('.terminal-tab').count()).toBeGreaterThan(initialTabs);

    await window.locator('button[title="Toggle split"]').click();
    await expect(window.locator('.terminal-sessions.split-horizontal')).toBeVisible();
  });

  test('ai pane scroll supports long logs', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.evaluate(async () => {
      const now = new Date().toISOString();
      await window.electronAPI.testClearAgentTasks();
      await window.electronAPI.testCreateAgentTaskFixture({
        id: 'scroll-task',
        goal: 'long logs',
        mode: 'plan',
        status: 'waiting_approval',
        phase: 'done',
        plan: '1. long logs',
        steps: [],
        logs: Array.from({ length: 260 }).map((_, idx) => ({
          id: `l-${idx}`,
          timestamp: now,
          level: 'info',
          message: `log-${idx} `.repeat(28),
        })),
        fileWrites: [],
        testRuns: [],
        createdAt: now,
        currentStepIndex: 0,
        workspaceRootPath: null,
        autoRunPipeline: false,
        cancelRequested: false,
      });
    });

    await window.locator('button[title="Code Editor"]').click();
    await expect(window.locator('.ai-pane-scroll')).toBeVisible();

    await expect.poll(async () => {
      return await window.evaluate(() => {
        const scroller = document.querySelector('.ai-pane-scroll') as HTMLDivElement | null;
        if (!scroller) return 0;
        return scroller.scrollHeight - scroller.clientHeight;
      });
    }).toBeGreaterThan(16);

    const scrolled = await window.evaluate(() => {
      const scroller = document.querySelector('.ai-pane-scroll') as HTMLDivElement | null;
      if (!scroller) return false;
      scroller.scrollTop = scroller.scrollHeight;
      return scroller.scrollTop > 0;
    });
    expect(scrolled).toBeTruthy();
  });

  test('ai pane restores width after collapse and reopen', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.locator('button[title="Code Editor"]').click();
    const initialWidth = await window.evaluate(() => {
      const pane = document.querySelector('.ai-pane') as HTMLElement | null;
      return pane?.getBoundingClientRect().width || 0;
    });
    expect(initialWidth).toBeGreaterThan(250);

    await window.locator('.ai-pane .ai-pane-collapse-btn').click();
    await expect(window.locator('.ai-pane.ai-pane-collapsed')).toBeVisible();
    await window.locator('.ai-pane.ai-pane-collapsed .ai-pane-collapse-btn').click();

    await expect.poll(async () => {
      return await window.evaluate(() => {
        const pane = document.querySelector('.ai-pane') as HTMLElement | null;
        return pane?.getBoundingClientRect().width || 0;
      });
    }).toBeGreaterThan(250);
  });

  test('build mode is blocked when no workspace is open', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.locator('button[title="Code Editor"]').click();
    await window.locator('.ai-pane .ai-pane-select').first().selectOption('build');
    await window.locator('.ai-pane-input').fill('Apply build changes');
    await window.locator('.ai-pane-run-btn').click();

    await expect(window.locator('.toast-message').filter({ hasText: 'Open a project first.' })).toBeVisible();
  });

  test('agents tab is visible in workspace', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.locator('button[title="Files"]').click();
    
    // Click "Agents" tab
    await window.locator('button:has-text("Agents")').click();
    
    // Verify agents view content
    await expect(window.locator('.workspace-pane-agents')).toBeVisible();
    await expect(window.locator('h2')).toContainText('Agent Orchestration');
  });

  test('approve plan auto-creates workspace when none is open', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.evaluate(async () => {
      const now = new Date().toISOString();
      await window.electronAPI.testClearAgentTasks();
      await window.electronAPI.testCreateAgentTaskFixture({
        id: 'auto-workspace-task',
        goal: 'Create a sample app automatically',
        mode: 'plan',
        status: 'waiting_approval',
        phase: 'done',
        plan: '1. Create project and continue',
        steps: [
          { id: 's1', description: 'Create README', status: 'pending' },
        ],
        logs: [],
        fileWrites: [],
        testRuns: [],
        createdAt: now,
        currentStepIndex: 0,
        workspaceRootPath: null,
        autoRunPipeline: false,
        cancelRequested: false,
      });
    });

    await window.locator('button[title="Code Editor"]').click();
    await window.locator('button:has-text("Approve Plan")').click();

    await expect.poll(async () => {
      return await window.evaluate(async () => {
        const tasks = await window.electronAPI.listAgentTasks();
        const task = tasks.find((item) => item.id === 'auto-workspace-task');
        return task?.workspaceRootPath || '';
      });
    }).toContain('projects');

    const workspacePath = await window.evaluate(async () => {
      const tasks = await window.electronAPI.listAgentTasks();
      const task = tasks.find((item) => item.id === 'auto-workspace-task');
      return task?.workspaceRootPath || '';
    });
    expect(/user-files[\\/]+projects/i.test(workspacePath)).toBeTruthy();

    const scaffoldText = await window.evaluate(async () => {
      const tasks = await window.electronAPI.listAgentTasks();
      const task = tasks.find((item) => item.id === 'auto-workspace-task');
      const root = task?.workspaceRootPath || '';
      if (!root) return null;
      const forwardPath = `${root.replace(/[\\/]$/, '')}/PROJECT.md`;
      const backwardPath = `${root.replace(/[\\/]$/, '')}\\PROJECT.md`;
      const forward = await window.electronAPI.readFile(forwardPath);
      if (forward !== null) return forward;
      return await window.electronAPI.readFile(backwardPath);
    });
    expect(scaffoldText).toContain('Workspace Root:');
  });

  test('files sort dropdown remains readable', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.locator('button[title="Files"]').click();
    const contrastOk = await window.evaluate(() => {
      const select = document.querySelector('.files-sort-select') as HTMLSelectElement | null;
      if (!select) return false;
      const style = getComputedStyle(select);
      const bg = style.backgroundColor.replace(/\s+/g, '');
      const fg = style.color.replace(/\s+/g, '');
      return bg !== fg && bg !== 'rgba(0,0,0,0)' && fg !== 'rgba(0,0,0,0)';
    });
    expect(contrastOk).toBeTruthy();
  });

  test('settings image model exposes local configuration controls', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.locator('button[title="Settings"]').click();
    await window.locator('#image-provider').selectOption('ollama');
    await expect(window.locator('#image-model')).toBeVisible();
    await expect(window.locator('.settings-field-hint').filter({ hasText: 'ollama pull <model>' })).toBeVisible();
    await expect(window.locator('button:has-text("Refresh Local Image Models")')).toBeVisible();
  });

  test('captures screenshots across primary tabs and states', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await captureScreenshot(window, 'chat-tab.png');

    await window.locator('button[title="Code Editor"]').click();
    await captureScreenshot(window, 'code-tab.png');
    await window.locator('button[title="Toggle split"]').click();
    await captureScreenshot(window, 'terminal-split.png');

    await window.locator('button[title="Files"]').click();
    await captureScreenshot(window, 'files-tab.png');

    await window.locator('button:has-text("Agents")').click();
    await captureScreenshot(window, 'agents-tab.png');

    await window.locator('button[title="Settings"]').click();
    await captureScreenshot(window, 'settings-tab.png');

    await window.locator('button[title="Code Editor"]').click();
    await window.locator('.ai-pane .ai-pane-select').first().click();
    await captureScreenshot(window, 'ai-pane-dropdown.png');
  });

  test('files tab can create new project', async () => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.locator('button[title="Files"]').click();

    const projectName = `TestProject-${Date.now()}`;
    await window.evaluate((name) => {
      window.prompt = () => name;
    }, projectName);

    await window.locator('button:has-text("+ Project")').click();
    await expect(window.locator('.toast-message').filter({ hasText: 'Project creation started...' })).toBeVisible();

    await expect.poll(async () => {
      return await window.evaluate(async (name) => {
        const files = await window.electronAPI.listFiles();
        const match = files.find((file) => file.name === name && file.isDirectory);
        if (!match) return false;
        return /user-files[\\/]+projects/i.test(match.path);
      }, projectName);
    }).toBeTruthy();

    await expect(window.locator('.toast-message').filter({ hasText: `Project "${projectName}" created at` })).toBeVisible();
  });
});
