// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

export async function installDockBounceSpy(app: ElectronApplication): Promise<void> {
    await app.evaluate(({app: electronApp}) => {
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
    });
}

export async function restoreDockBounceSpy(app: ElectronApplication): Promise<void> {
    await app.evaluate(({app: electronApp}) => {
        const dock = electronApp.dock;
        if (dock && (dock as any).__e2eOriginalBounce) {
            dock.bounce = (dock as any).__e2eOriginalBounce;
            delete (dock as any).__e2eOriginalBounce;
        }
        delete (electronApp as any).__e2eDockBounceCalls;
    });
}

export async function installFlashFrameSpy(app: ElectronApplication): Promise<void> {
    await app.evaluate(() => {
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
    await app.evaluate(() => {
        const refs = (global as any).__e2eTestRefs;
        const mainWin = refs?.MainWindow?.get?.();
        if (mainWin && (mainWin as any).__e2eOriginalFlashFrame) {
            mainWin.flashFrame = (mainWin as any).__e2eOriginalFlashFrame;
            delete (mainWin as any).__e2eOriginalFlashFrame;
        }
        delete (global as any).__e2eFlashFrameCalls;
    });
}
