import { _electron as electron, test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Application Launch', () => {
  let app: any;

  test.beforeEach(async () => {
    // Launch the electron app
    // We point to the main entry point compiled by tsc
    app = await electron.launch({
      args: [path.join(__dirname, '../dist/main/index.js')],
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
});
