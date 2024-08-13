// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent} from 'electron';
import {BrowserWindow, systemPreferences} from 'electron';

import Config from 'common/config';
import {Logger} from 'common/log';

const log = new Logger('App.Windows');

export const handleGetDarkMode = () => {
    return Config.darkMode;
};

export const handleDoubleClick = (event: IpcMainEvent, windowType?: string) => {
    log.debug('handleDoubleClick', windowType);

    let action = 'Maximize';
    if (process.platform === 'darwin') {
        action = systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string');
    }
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
        return;
    }
    switch (action) {
    case 'Minimize':
        if (win.isMinimized()) {
            win.restore();
        } else {
            win.minimize();
        }
        break;
    case 'Maximize':
    default:
        if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
        break;
    }
};
