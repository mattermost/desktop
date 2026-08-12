// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BrowserWindow} from 'electron';

import Config from 'common/config';
import {setTestField} from 'common/utils/util';

/**
 * Register listeners on the main BrowserWindow so `__e2eAppReady` is set at the
 * first reliable lifecycle point. Must run from MainWindow.init() before
 * index.html finishes loading — otherwise a fast `show` during later startup
 * work can fire before any listener is attached.
 */
export function registerMainWindowE2EReadiness(win: BrowserWindow): void {
    if (process.env.NODE_ENV !== 'test') {
        return;
    }

    const markReady = () => setTestField('__e2eAppReady', true);

    win.once('show', markReady);

    if (Config.hideOnStart) {
        win.webContents.once('did-finish-load', () => {
            if (!win.isDestroyed() && win.webContents.getURL().includes('index')) {
                markReady();
            }
        });
    }
}
