// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {evaluateInMainProcess, evaluateInMainProcessWithArg} from './testRefs';

// These spies install/restore around navigation-heavy flows (e.g. tests that
// hide the main window, trigger notifications, then re-show it), during which
// Electron's evaluate context can be transiently destroyed. Routing through
// evaluateInMainProcess[WithArg] gives us the same "retry on transient
// context-destroyed errors" behavior used by the tray helpers.

export async function installDockBounceSpy(app: ElectronApplication): Promise<void> {
    await evaluateInMainProcessWithArg(app, ({app: electronApp}) => {
        (electronApp as any).__e2eDockBounceCalls = [];
        const dock = electronApp.dock;
        if (!dock) {
            return;
        }
        const originalBounce = dock.bounce.bind(dock);
        (dock as any).__e2eOriginalBounce = originalBounce;
        dock.bounce = ((type?: 'informational' | 'critical') => {
            (electronApp as any).__e2eDockBounceCalls.push(type ?? 'informational');
            return originalBounce(type);
        }) as typeof dock.bounce;
    }, null);
}

export async function restoreDockBounceSpy(app: ElectronApplication): Promise<void> {
    await evaluateInMainProcessWithArg(app, ({app: electronApp}) => {
        const dock = electronApp.dock;
        if (dock && (dock as any).__e2eOriginalBounce) {
            dock.bounce = (dock as any).__e2eOriginalBounce;
            delete (dock as any).__e2eOriginalBounce;
        }
        delete (electronApp as any).__e2eDockBounceCalls;
    }, null);
}

export async function installFlashFrameSpy(app: ElectronApplication): Promise<void> {
    await evaluateInMainProcess(app, () => {
        (global as any).__e2eFlashFrameCalls = [];
        const refs = (global as any).__e2eTestRefs;
        const mainWin = refs?.MainWindow?.get?.();
        if (!mainWin) {
            throw new Error('Main window not available for flashFrame spy');
        }
        const originalFlashFrame = mainWin.flashFrame.bind(mainWin);
        (mainWin as any).__e2eOriginalFlashFrame = originalFlashFrame;
        mainWin.flashFrame = (flash: boolean) => {
            (global as any).__e2eFlashFrameCalls.push(flash);
            originalFlashFrame(flash);
        };
    });
}

export async function restoreFlashFrameSpy(app: ElectronApplication): Promise<void> {
    await evaluateInMainProcess(app, () => {
        const refs = (global as any).__e2eTestRefs;
        const mainWin = refs?.MainWindow?.get?.();
        if (mainWin && (mainWin as any).__e2eOriginalFlashFrame) {
            mainWin.flashFrame = (mainWin as any).__e2eOriginalFlashFrame;
            delete (mainWin as any).__e2eOriginalFlashFrame;
        }
        delete (global as any).__e2eFlashFrameCalls;
    });
}

export async function getFlashFrameCalls(app: ElectronApplication): Promise<boolean[]> {
    return evaluateInMainProcess(app, () => (global as any).__e2eFlashFrameCalls ?? []);
}
