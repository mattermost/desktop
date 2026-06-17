// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {evaluateInMainProcess, evaluateInMainProcessWithArg} from './testRefs';

export async function emitTrayIconClick(app: ElectronApplication): Promise<void> {
    await evaluateInMainProcess(app, () => {
        const refs = (global as any).__e2eTestRefs;
        const tray = refs?.TrayIcon?.tray;
        if (!tray || tray.isDestroyed?.()) {
            throw new Error('Tray icon is not initialized');
        }
        tray.emit('click');
    });
}

export async function clickTrayMenuItem(app: ElectronApplication, label: string): Promise<void> {
    await evaluateInMainProcessWithArg(app, (_electron, menuLabel) => {
        const clickTrayMenuItem = (global as any).__e2eClickTrayMenuItem as ((value: string) => void) | undefined;
        if (!clickTrayMenuItem) {
            throw new Error('__e2eClickTrayMenuItem not exposed (NODE_ENV must be test)');
        }
        clickTrayMenuItem(menuLabel);
    }, label);
}

export async function isMainWindowVisible(app: ElectronApplication): Promise<boolean> {
    return evaluateInMainProcess(app, () => {
        const refs = (global as any).__e2eTestRefs;
        const mainWindow = refs?.MainWindow?.get?.();
        return Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible());
    });
}
