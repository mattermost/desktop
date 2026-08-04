// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcMain, webContents} from 'electron';

import MainWindow from 'app/mainWindow/mainWindow';
import TabManager from 'app/tabs/tabManager';
import WebContentsManager from 'app/views/webContentsManager';
import {BROWSER_HISTORY_PUSH, NOTIFICATION_CLICKED} from 'common/communication';

export type SimulateNotificationClickPayload = {
    webContentsId: number;
    channelId: string;
    teamId: string;
    url: string;
};

/** Mirrors notifications/index.ts mention click handler — E2E only. */
function dispatchMentionClick(
    view: {id: string},
    wc: Electron.WebContents,
    channelId: string,
    teamId: string,
    url: string,
) {
    const focus = () => {
        MainWindow.show();
        TabManager.switchToTab(view.id);
        ipcMain.off(BROWSER_HISTORY_PUSH, focus);
    };
    ipcMain.on(BROWSER_HISTORY_PUSH, focus);
    wc.send(NOTIFICATION_CLICKED, channelId, teamId, url);
}

export function simulateNotificationClick(payload: SimulateNotificationClickPayload) {
    const wc = webContents.fromId(payload.webContentsId);
    if (!wc || wc.isDestroyed()) {
        throw new Error(`webContents ${payload.webContentsId} is not available`);
    }

    const view = WebContentsManager.getViewByWebContentsId(wc.id);
    if (!view) {
        throw new Error(`No view for webContents ${payload.webContentsId}`);
    }

    dispatchMentionClick(view, wc, payload.channelId, payload.teamId, payload.url);
}
