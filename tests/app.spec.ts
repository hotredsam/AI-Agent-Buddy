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

    // Click Settings button in sidebar
    await window.locator('button[title="Settings"]').click();
    
    // Verify Settings pane is visible
    const settingsPane = await window.locator('.settings-pane');
    await expect(settingsPane).toBeVisible();
  });
});
