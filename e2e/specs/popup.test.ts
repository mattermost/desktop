// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import {test, expect} from '../fixtures/index';
import {cmdOrCtrl, demoMattermostConfig} from '../helpers/config';
import {waitForAppReady} from '../helpers/appReadiness';
import {appDir, electronBinaryPath, writeConfigFile} from '../helpers/config';
import {waitForWindow, closeElectronApp} from '../helpers/electronApp';
import {loginToMattermost} from '../helpers/login';
import {buildServerMap} from '../helpers/serverMap';
import type {ServerView} from '../helpers/serverView';

type ElectronApplication = Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>;
type ElectronPage = import('playwright').Page;

let electronApp: ElectronApplication;
let mainWindow: ElectronPage;
let firstServer: ServerView;
let userDataDir: string;

async function openMockPopup(
    serverView: ServerView,
    app: ElectronApplication,
) {
    const popupPromise = app.waitForEvent('window', {
        predicate: (window) => window.url() === 'about:blank',
        timeout: 30_000,
    });

    await serverView.evaluate(() => {
        const popup = window.open('about:blank', '_blank');
        if (!popup) {
            throw new Error('Popup window was not created');
        }

        popup.document.open();
        popup.document.write(`
            <!DOCTYPE html>
            <html>
            <body>
                <form>
                    <input id="login_field" type="text" />
                </form>
            </body>
            </html>
        `);
        popup.document.close();
        popup.focus();
    });

    const popupWindow = await popupPromise;
    await popupWindow.waitForLoadState();
    await popupWindow.bringToFront();
    await popupWindow.waitForSelector('#login_field');
    return popupWindow;
}

test.describe('popup', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeAll(async () => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mm-popup-e2e-'));
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
        firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
        if (!firstServer) {
            throw new Error('No server view available for popup tests');
        }

        await loginToMattermost(firstServer);
        await mainWindow.waitForSelector('.ServerDropdownButton', {timeout: 30_000});
    });

    test.afterEach(async () => {
        const popups = electronApp.windows().filter((window) => {
            try {
                return window.url() === 'about:blank';
            } catch {
                return false;
            }
        });

        for (const popup of popups) {
            await popup.close().catch(() => {});
        }
    });

    test.afterAll(async () => {
        await closeElectronApp(electronApp, userDataDir);
    });

    test('MM-T2827_1 should be able to select all in popup windows', {tag: ['@P2', '@all']}, async () => {
        const popupWindow = await openMockPopup(firstServer, electronApp);

        const loginField = await popupWindow.waitForSelector('#login_field');
        await loginField.focus();
        await popupWindow.keyboard.type('Mattermost');

        const selectAllKey = cmdOrCtrl === 'command' ? 'Meta+a' : 'Control+a';
        await popupWindow.keyboard.press(selectAllKey);

        const selectedText = await popupWindow.evaluate(() => {
            const box = document.querySelectorAll('#login_field')[0] as HTMLInputElement;
            return box.value.substring(box.selectionStart!, box.selectionEnd!);
        });
        expect(selectedText).toBe('Mattermost');
    });

    test('MM-T2827_2 should be able to cut and paste in popup windows', {tag: ['@P2', '@all']}, async () => {
        const popupWindow = await openMockPopup(firstServer, electronApp);

        const loginField = await popupWindow.waitForSelector('#login_field');
        await loginField.focus();
        await popupWindow.keyboard.type('Mattermost');

        const textbox = await popupWindow.waitForSelector('#login_field');
        await textbox.selectText({force: true});
        const cutKey = cmdOrCtrl === 'command' ? 'Meta+x' : 'Control+x';
        await popupWindow.keyboard.press(cutKey);
        let textValue = await textbox.inputValue();
        expect(textValue).toBe('');

        await textbox.focus();
        const pasteKey = cmdOrCtrl === 'command' ? 'Meta+v' : 'Control+v';
        await popupWindow.keyboard.press(pasteKey);
        textValue = await textbox.inputValue();
        expect(textValue).toBe('Mattermost');
    });

    test('MM-T2827_3 should be able to copy and paste in popup windows', {tag: ['@P2', '@all']}, async () => {
        const popupWindow = await openMockPopup(firstServer, electronApp);

        const loginField = await popupWindow.waitForSelector('#login_field');
        await loginField.focus();
        await popupWindow.keyboard.type('Mattermost');

        const textbox = await popupWindow.waitForSelector('#login_field');
        await textbox.selectText({force: true});
        const copyKey = cmdOrCtrl === 'command' ? 'Meta+c' : 'Control+c';
        await popupWindow.keyboard.press(copyKey);
        await textbox.focus();
        await textbox.type('other-text');
        const pasteKey = cmdOrCtrl === 'command' ? 'Meta+v' : 'Control+v';
        await popupWindow.keyboard.press(pasteKey);
        const textValue = await textbox.inputValue();
        expect(textValue).toBe('other-textMattermost');
    });

    test('MM-T1659 should not be able to go Back or Forward in the popup window', {tag: ['@P2', '@all']}, async () => {
        const popupWindow = await openMockPopup(firstServer, electronApp);
        await popupWindow.waitForSelector('#login_field');

        const currentURL = popupWindow.url();

        // Try and go back
        if (process.platform === 'darwin') {
            await popupWindow.keyboard.press('Meta+[');
        } else {
            await popupWindow.keyboard.press('Alt+ArrowLeft');
        }
        expect(popupWindow.url()).toBe(currentURL);

        // Try and go forward
        if (process.platform === 'darwin') {
            await popupWindow.keyboard.press('Meta+]');
        } else {
            await popupWindow.keyboard.press('Alt+ArrowRight');
        }
        expect(popupWindow.url()).toBe(currentURL);
    });
});
