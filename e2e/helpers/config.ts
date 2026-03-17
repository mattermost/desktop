// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

export const sourceRootDir = path.join(__dirname, '../..');

// The Electron binary from the npm package
export const electronBinaryPath = (() => {
    if (process.platform === 'darwin') {
        return path.join(sourceRootDir, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
    }
    const ext = process.platform === 'win32' ? '.exe' : '';
    return path.join(sourceRootDir, `node_modules/electron/dist/electron${ext}`);
})();

// Test build app directory — built by `npm run build-test` (NODE_ENV=test)
// When NODE_ENV=test, webpack outputs to e2e/dist/ instead of dist/
// Electron is launched with this directory as args[0]
export const appDir = path.join(sourceRootDir, 'e2e/dist');

export const mattermostURL = process.env.MM_TEST_SERVER_URL ?? 'http://localhost:8065/';

export const exampleURL = 'http://example.com/';

export const cmdOrCtrl = process.platform === 'darwin' ? 'command' : 'control';

// ---- Config shapes ----

export type AppConfig = {
    version: number;
    servers: Array<{name: string; url: string; order: number}>;
    showTrayIcon: boolean;
    trayIconTheme: string;
    minimizeToTray: boolean;
    notifications: {flashWindow: number; bounceIcon: boolean; bounceIconType: string};
    showUnreadBadge: boolean;
    useSpellChecker: boolean;
    enableHardwareAcceleration: boolean;
    autostart: boolean;
    hideOnStart: boolean;
    spellCheckerLocales: string[];
    darkMode: boolean;
    lastActiveServer: number;
    startInFullscreen: boolean;
    autoCheckForUpdates: boolean;
    appLanguage: string;
    logLevel: string;
    viewLimit: number;
};

const baseConfig: AppConfig = {
    version: 4,
    servers: [],
    showTrayIcon: false,
    trayIconTheme: 'light',
    minimizeToTray: false,
    notifications: {flashWindow: 0, bounceIcon: false, bounceIconType: 'informational'},
    showUnreadBadge: true,
    useSpellChecker: true,
    enableHardwareAcceleration: true,
    autostart: true,
    hideOnStart: false,
    spellCheckerLocales: [],
    darkMode: false,
    lastActiveServer: 0,
    startInFullscreen: false,
    autoCheckForUpdates: true,
    appLanguage: 'en',
    logLevel: 'silly',
    viewLimit: 15,
};

// Two demo servers (no live Mattermost needed): example.com + github.com
export const demoConfig: AppConfig = {
    ...baseConfig,
    servers: [
        {name: 'example', url: exampleURL, order: 0},
        {name: 'github', url: 'https://github.com/', order: 1},
    ],
};

// Single Mattermost server (requires MM_TEST_SERVER_URL)
export const demoMattermostConfig: AppConfig = {
    ...baseConfig,
    servers: [
        {name: 'example', url: mattermostURL, order: 0},
        {name: 'github', url: 'https://github.com/', order: 1},
    ],
};

// No servers — triggers welcome screen
export const emptyConfig: AppConfig = {
    ...baseConfig,
    servers: [],
};

// ---- File writer ----

/**
 * Write app config to userDataDir/config.json.
 * MUST be synchronous — must complete before electron.launch() is called.
 */
export function writeConfigFile(userDataDir: string, config: AppConfig): void {
    fs.writeFileSync(path.join(userDataDir, 'config.json'), JSON.stringify(config, null, 2));
}
