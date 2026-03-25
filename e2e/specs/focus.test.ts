// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import {test, expect} from '../fixtures/index';
import {waitForAppReady} from '../helpers/appReadiness';
import {electronBinaryPath, appDir, demoMattermostConfig, writeConfigFile} from '../helpers/config';
import {waitForLockFileRelease} from '../helpers/cleanup';
import {loginToMattermost} from '../helpers/login';
import {buildServerMap, type ServerMap} from '../helpers/serverMap';

const SHOW_SETTINGS_WINDOW = 'show-settings-window';
const SHOW_NEW_SERVER_MODAL = 'show_new_server_modal';

const config = {
    ...demoMattermostConfig,
    servers: [
        ...demoMattermostConfig.servers,
        {
            name: 'community',
            url: process.env.MM_TEST_SERVER_URL ?? 'http://localhost:8065',
            order: 0,
        },
    ],
};

type ElectronApplication = Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>;
type ServerWin = ServerMap[string][number]['win'];

async function focusMainWindow(app: ElectronApplication) {
    await app.evaluate(({app: electronApp}) => {
        const refs = (global as any).__e2eTestRefs;
        const mainWindow = refs?.MainWindow?.get?.();
        if (!mainWindow || mainWindow.isDestroyed()) {
            return;
        }
        if (process.platform === 'darwin') {
            electronApp.show();
        }
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
    }).catch(() => {});
}

async function openSettingsWindow(electronApp: ElectronApplication) {
    const existingWindow = electronApp.windows().find((window) => window.url().includes('settings'));
    if (existingWindow) {
        await existingWindow.waitForLoadState().catch(() => {});
        return existingWindow;
    }

    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            await electronApp.evaluate(({ipcMain}, showWindow) => {
                ipcMain.emit(showWindow);
            }, SHOW_SETTINGS_WINDOW);
            break;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes('Execution context was destroyed') || attempt === 4) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }

    const settingsWindow = electronApp.windows().find((window) => window.url().includes('settings')) ??
        await electronApp.waitForEvent('window', {
            predicate: (window) => window.url().includes('settings'),
            timeout: 15_000,
        });
    await settingsWindow.waitForLoadState().catch(() => {});
    return settingsWindow;
}

async function openNewServerWindow(electronApp: ElectronApplication) {
    const existingWindow = electronApp.windows().find((window) => window.url().includes('newServer'));
    if (existingWindow) {
        await existingWindow.waitForLoadState().catch(() => {});
        return existingWindow;
    }

    await electronApp.evaluate(({ipcMain}, showWindow) => {
        ipcMain.emit(showWindow);
    }, SHOW_NEW_SERVER_MODAL);

    const newServerWindow = await electronApp.waitForEvent('window', {
        predicate: (window) => window.url().includes('newServer'),
        timeout: 15_000,
    });
    await newServerWindow.waitForLoadState().catch(() => {});
    return newServerWindow;
}

async function switchToServer(electronApp: ElectronApplication, serverName: string) {
    await electronApp.evaluate((_, targetServerName) => {
        const refs = (global as any).__e2eTestRefs;
        const server = refs?.ServerManager?.getAllServers?.().find((candidate: any) => candidate.name === targetServerName);
        if (!server) {
            throw new Error(`Server not found: ${targetServerName}`);
        }
        refs.ServerManager.updateCurrentServer(server.id);
    }, serverName);
}

test.describe('focus', () => {
    test.describe.configure({mode: 'serial'});

    let electronApp: ElectronApplication;
    let serverMap: ServerMap;
    let firstServer: ServerWin;
    let secondServer: ServerWin;
    let userDataDir: string;

    test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

    test.beforeAll(async () => {
        userDataDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mm-focus-e2e-'));
        writeConfigFile(userDataDir, config);

        const {_electron: electron} = await import('playwright');
        electronApp = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 60_000,
        });
        await waitForAppReady(electronApp);

        // Poll until both servers are registered in WebContentsManager
        const primaryServerName = config.servers[0].name;
        const deadline = Date.now() + 30_000;
        while (Date.now() < deadline) {
            serverMap = await buildServerMap(electronApp);
            if (serverMap[primaryServerName]?.[0] && serverMap.community?.[0]) {
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const primaryServer = serverMap[primaryServerName]?.[0]?.win;
        const communityServer = serverMap.community?.[0]?.win;
        if (!primaryServer || !communityServer) {
            throw new Error('Required server views not found');
        }

        firstServer = primaryServer;
        secondServer = communityServer;

        await loginToMattermost(firstServer);
        await firstServer.waitForSelector('#post_textbox');
    });

    test.afterAll(async () => {
        await electronApp?.close().catch(() => {});
        if (userDataDir) {
            await waitForLockFileRelease(userDataDir).catch(() => {});
        }
    });

    test.beforeEach(async () => {
        const settingsWindow = electronApp.windows().find((window) => window.url().includes('settings'));
        if (settingsWindow) {
            await settingsWindow.close().catch(() => {});
        }

        const newServerWindow = electronApp.windows().find((window) => window.url().includes('newServer'));
        if (newServerWindow) {
            await newServerWindow.close().catch(() => {});
        }

        await firstServer.fill('#post_textbox', '');
        await firstServer.focus('#post_textbox');

        await switchToServer(electronApp, 'example');

        // Ensure the main BrowserWindow has OS focus so that parentWindow.isFocused()
        // returns true when TabManager.focusCurrentTab() is called after modal close.
        await focusMainWindow(electronApp);
    });

    test.describe('Focus textbox tests', () => {
        // BrowserWindow.isFocused() returns false in headless CI environments (Linux Xvfb,
        // GitHub Actions macOS runners), so MattermostWebContentsView.focus() silently
        // skips webContents.focus(). These tests require a real interactive desktop session.
        test.skip(
            process.platform === 'linux' || Boolean(process.env.CI),
            'OS window focus unreliable in headless CI environments',
        );

        test('MM-T1315 should return focus to the message box when closing the settings modal', {tag: ['@P2', '@all']}, async () => {
            const textbox = await firstServer.waitForSelector('#post_textbox');
            await textbox.focus();

            const settingsWindow = await openSettingsWindow(electronApp);
            await settingsWindow.waitForSelector('.SettingsModal');

            // Use cancelModal() instead of page.close() so that the modal manager's
            // handleModalFinished path runs and TabManager.focusCurrentTab() is called.
            await settingsWindow.evaluate(() => {
                (window as any).desktop.modals.cancelModal();
            });

            // Wait for focus to return to textbox after modal close
            await firstServer.waitForFunction(
                () => document.activeElement?.id === 'post_textbox',
                {timeout: 15_000},
            );

            const isTextboxFocused = await firstServer.$eval('#post_textbox', (el) => el === document.activeElement);
            expect(isTextboxFocused).toBe(true);

            await firstServer.fill('#post_textbox', '');

            // Make sure you can just start typing and it'll go in the post textbox
            await firstServer.fill('#post_textbox', 'Mattermost');

            const textboxString = await firstServer.inputValue('#post_textbox');
            expect(textboxString).toBe('Mattermost');
        });

        test('MM-T1316 should return focus to the message box when closing the Add Server modal', {tag: ['@P2', '@all']}, async () => {
            const textbox = await firstServer.waitForSelector('#post_textbox');
            await textbox.focus();

            const newServerView = await openNewServerWindow(electronApp);
            await newServerView.waitForSelector('#newServerModal_cancel');
            await newServerView.close();

            const isTextboxFocused = await firstServer.$eval('#post_textbox', (el) => el === document.activeElement);
            expect(isTextboxFocused).toBe(true);

            await firstServer.fill('#post_textbox', '');

            // Make sure you can just start typing and it'll go in the post textbox
            await firstServer.fill('#post_textbox', 'Mattermost');

            const textboxString = await firstServer.inputValue('#post_textbox');
            expect(textboxString).toBe('Mattermost');
        });

        test('MM-T1317 should return focus to the focused box when switching servers', {tag: ['@P2', '@all']}, async () => {
            const textbox = await firstServer.waitForSelector('#post_textbox');
            await textbox.focus();

            await switchToServer(electronApp, 'community');
            await secondServer.waitForSelector('#input_loginId');
            await secondServer.focus('#input_loginId');

            await switchToServer(electronApp, config.servers[0].name);
            const isTextboxFocused = await firstServer.$eval('#post_textbox', (el) => el === document.activeElement);
            expect(isTextboxFocused).toBe(true);

            await firstServer.fill('#post_textbox', '');

            // Make sure you can just start typing and it'll go in the post textbox
            await firstServer.fill('#post_textbox', 'Mattermost');

            const textboxString = await firstServer.inputValue('#post_textbox');
            expect(textboxString).toBe('Mattermost');

            await switchToServer(electronApp, 'community');
            const isLoginFocused = await secondServer.$eval('#input_loginId', (el) => el === document.activeElement);
            expect(isLoginFocused).toBe(true);

            // Make sure you can just start typing and it'll go in the login field
            await secondServer.keyboard.type('username');

            const loginString = await secondServer.inputValue('#input_loginId');
            expect(loginString).toBe('username');
        });
    });
});
