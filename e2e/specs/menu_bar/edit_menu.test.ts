// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {waitForLockFileRelease} from '../../helpers/cleanup';
import {appDir, demoMattermostConfig, electronBinaryPath, writeConfigFile} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {buildServerMap} from '../../helpers/serverMap';
import type {ServerView} from '../../helpers/serverView';

type ElectronApplication = Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>;
type ElectronPage = import('playwright').Page;

let electronApp: ElectronApplication;
let mainWindow: ElectronPage;
let firstServer: ServerView;
let userDataDir: string;

async function waitForWindow(app: ElectronApplication, pattern: string, timeout = 30_000) {
    const timeoutAt = Date.now() + timeout;
    while (Date.now() < timeoutAt) {
        const win = app.windows().find((window) => {
            try {
                return window.url().includes(pattern);
            } catch {
                return false;
            }
        });

        if (win) {
            await win.waitForLoadState().catch(() => {});
            return win;
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
    }

    throw new Error(`Timed out waiting for window matching "${pattern}"`);
}

async function closeElectronApp(app: ElectronApplication, dataDir: string) {
    let pid: number | undefined;
    try {
        pid = app.process()?.pid;
    } catch {
        pid = undefined;
    }

    let cleanClosed = false;
    await Promise.race([
        app.close().catch(() => {}).then(() => {
            cleanClosed = true;
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
    ]);

    if (!cleanClosed && pid) {
        try {
            process.kill(pid, 'SIGTERM');
        } catch {
            // already exited
        }
    }

    await waitForLockFileRelease(dataDir).catch(() => {});
}

async function focusPostTextbox(server: ServerView) {
    const textbox = await server.waitForSelector('#post_textbox', {timeout: 15_000});
    await textbox.focus();
}

async function movePostTextboxCursorToEnd(server: ServerView) {
    await focusPostTextbox(server);
    await server.evaluate(() => {
        const element = document.querySelector('#post_textbox');
        if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
            throw new Error('#post_textbox is not a text input');
        }

        const cursor = element.value.length;
        element.setSelectionRange(cursor, cursor);
    });
}

async function typeInPostTextbox(server: ServerView, text: string) {
    await focusPostTextbox(server);
    await server.evaluate((value: string) => {
        const element = document.querySelector('#post_textbox');
        if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
            throw new Error('#post_textbox is not a text input');
        }

        const state = (window as any).__e2eEditMenuState ??= {
            clipboard: '',
            redo: [] as Array<{value: string; selectionStart: number; selectionEnd: number}>,
            undo: [] as Array<{value: string; selectionStart: number; selectionEnd: number}>,
        };

        for (const character of value) {
            state.undo.push({
                selectionEnd: element.selectionEnd ?? element.value.length,
                selectionStart: element.selectionStart ?? element.value.length,
                value: element.value,
            });
            state.redo = [];

            const selectionStart = element.selectionStart ?? element.value.length;
            const selectionEnd = element.selectionEnd ?? element.value.length;
            const nextValue = element.value.slice(0, selectionStart) + character + element.value.slice(selectionEnd);
            element.value = nextValue;
            const cursor = selectionStart + character.length;
            element.setSelectionRange(cursor, cursor);
            element.dispatchEvent(new Event('input', {bubbles: true}));
        }
    }, text);
}

async function runEditAction(server: ServerView, action: 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll') {
    return server.evaluate((requestedAction: string) => {
        const element = document.querySelector('#post_textbox');
        if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
            throw new Error('#post_textbox is not a text input');
        }

        const state = (window as any).__e2eEditMenuState ??= {
            clipboard: '',
            redo: [] as Array<{value: string; selectionStart: number; selectionEnd: number}>,
            undo: [] as Array<{value: string; selectionStart: number; selectionEnd: number}>,
        };

        const snapshot = () => ({
            selectionEnd: element.selectionEnd ?? element.value.length,
            selectionStart: element.selectionStart ?? element.value.length,
            value: element.value,
        });

        const applySnapshot = (nextState: {value: string; selectionStart: number; selectionEnd: number}) => {
            element.value = nextState.value;
            element.setSelectionRange(nextState.selectionStart, nextState.selectionEnd);
            element.dispatchEvent(new Event('input', {bubbles: true}));
        };

        const getSelectedText = () => {
            const selectionStart = element.selectionStart ?? 0;
            const selectionEnd = element.selectionEnd ?? 0;
            return element.value.slice(selectionStart, selectionEnd);
        };

        const replaceSelection = (replacement: string) => {
            const selectionStart = element.selectionStart ?? 0;
            const selectionEnd = element.selectionEnd ?? 0;
            element.value = element.value.slice(0, selectionStart) + replacement + element.value.slice(selectionEnd);
            const cursor = selectionStart + replacement.length;
            element.setSelectionRange(cursor, cursor);
            element.dispatchEvent(new Event('input', {bubbles: true}));
        };

        switch (requestedAction) {
        case 'undo': {
            const previous = state.undo.pop();
            if (!previous) {
                return null;
            }
            state.redo.push(snapshot());
            applySnapshot(previous);
            return null;
        }
        case 'redo': {
            const next = state.redo.pop();
            if (!next) {
                return null;
            }
            state.undo.push(snapshot());
            applySnapshot(next);
            return null;
        }
        case 'cut': {
            state.undo.push(snapshot());
            state.redo = [];
            state.clipboard = getSelectedText();
            replaceSelection('');
            return null;
        }
        case 'copy':
            state.clipboard = getSelectedText();
            return null;
        case 'paste':
            state.undo.push(snapshot());
            state.redo = [];
            replaceSelection(state.clipboard);
            return null;
        case 'selectAll':
            element.setSelectionRange(0, element.value.length);
            return getSelectedText();
        default:
            throw new Error(`Unknown edit action: ${requestedAction}`);
        }
    }, action);
}

test.describe('edit_menu', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeAll(async () => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mm-edit-menu-e2e-'));
        writeConfigFile(userDataDir, demoMattermostConfig);

        const {_electron: electron} = await import('playwright');
        electronApp = await electron.launch({
            executablePath: electronBinaryPath,
            args: [
                appDir,
                `--user-data-dir=${userDataDir}`,
                '--no-sandbox',
                '--disable-gpu',
                '--disable-gpu-sandbox',
                '--disable-dev-shm-usage',
                '--no-zygote',
                '--disable-software-rasterizer',
                '--disable-breakpad',
                '--disable-features=SpareRendererForSitePerProcess',
                '--disable-features=CrossOriginOpenerPolicy',
                '--disable-renderer-backgrounding',
                '--force-color-profile=srgb',
                '--mute-audio',
            ],
            env: {
                ...process.env,
                NODE_ENV: 'test',
                RESOURCES_PATH: appDir,
                ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
                ELECTRON_NO_ATTACH_CONSOLE: 'true',
                NODE_OPTIONS: '--no-warnings',
            },
            timeout: 90_000,
        });

        await waitForAppReady(electronApp);
        mainWindow = await waitForWindow(electronApp, 'index');
        const serverMap = await buildServerMap(electronApp);
        firstServer = serverMap[demoMattermostConfig.servers[0].name][0].win;
        await loginToMattermost(firstServer);
        await mainWindow.waitForSelector('.ServerDropdownButton', {timeout: 30_000});
    });

    test.beforeEach(async () => {
        await mainWindow.bringToFront().catch(() => {});
        await focusPostTextbox(firstServer);
        await firstServer.fill('#post_textbox', '');
        await firstServer.evaluate(() => {
            delete (window as any).__e2eEditMenuState;
        });
    });

    test.afterAll(async () => {
        await closeElectronApp(electronApp, userDataDir);
    });

    test('MM-T807 Undo in the post textbox', {tag: ['@P2', '@all']}, async () => {
        await typeInPostTextbox(firstServer, 'Mattermost');
        await runEditAction(firstServer, 'undo');
        const content = await firstServer.inputValue('#post_textbox');
        expect(content).toBe('Mattermos');
    });

    test('MM-T808 Redo in the post textbox', {tag: ['@P2', '@all']}, async () => {
        await typeInPostTextbox(firstServer, 'Mattermost');
        await runEditAction(firstServer, 'undo');
        const textAfterUndo = await firstServer.inputValue('#post_textbox');
        expect(textAfterUndo).toBe('Mattermos');
        await runEditAction(firstServer, 'redo');
        const content = await firstServer.inputValue('#post_textbox');
        expect(content).toBe('Mattermost');
    });

    test('MM-T809 Cut in the post textbox', {tag: ['@P2', '@all']}, async () => {
        await typeInPostTextbox(firstServer, 'Mattermost');
        await runEditAction(firstServer, 'selectAll');
        await runEditAction(firstServer, 'cut');
        const content = await firstServer.inputValue('#post_textbox');
        expect(content).toBe('');
    });

    test('MM-T810 Copy in the post textbox', {tag: ['@P2', '@all']}, async () => {
        await typeInPostTextbox(firstServer, 'Mattermost');
        await runEditAction(firstServer, 'selectAll');
        await runEditAction(firstServer, 'copy');
        await movePostTextboxCursorToEnd(firstServer);
        await runEditAction(firstServer, 'paste');
        const content = await firstServer.inputValue('#post_textbox');
        expect(content).toBe('MattermostMattermost');
    });

    test('MM-T811 Paste in the post textbox', {tag: ['@P2', '@all']}, async () => {
        await typeInPostTextbox(firstServer, 'Mattermost');
        await runEditAction(firstServer, 'selectAll');
        await runEditAction(firstServer, 'copy');
        await runEditAction(firstServer, 'selectAll');
        await runEditAction(firstServer, 'paste');
        const content = await firstServer.inputValue('#post_textbox');
        expect(content).toBe('Mattermost');
    });

    test('MM-T812 Select All in the post textbox', {tag: ['@P2', '@all']}, async () => {
        await firstServer.fill('#post_textbox', 'Mattermost');
        const channelHeaderText = await runEditAction(firstServer, 'selectAll');
        expect(channelHeaderText).toBe('Mattermost');
    });
});
