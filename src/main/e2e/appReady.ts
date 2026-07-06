// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BrowserWindow} from 'electron';

import MainWindow from 'app/mainWindow/mainWindow';
import {MAIN_WINDOW_CREATED} from 'common/communication';
import {setTestField} from 'common/utils/util';

/**
 * Signals `__e2eAppReady` once the main window is visible so Playwright can wait
 * on app readiness. No-op outside NODE_ENV=test.
 */
export function signalE2EAppReadyWhenShown(): void {
    if (process.env.NODE_ENV !== 'test') {
        return;
    }

    const markReady = () => setTestField('__e2eAppReady', true);
    const whenVisible = (win: BrowserWindow) => {
        if (win.isVisible()) {
            markReady();
        } else {
            win.once('show', markReady);
        }
    };

    const win = MainWindow.get();
    if (win) {
        whenVisible(win);
        return;
    }

    MainWindow.once(MAIN_WINDOW_CREATED, () => {
        const created = MainWindow.get();
        if (created) {
            whenVisible(created);
        }
    });
}
