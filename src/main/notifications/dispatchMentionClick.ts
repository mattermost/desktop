// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcMain} from 'electron';

import MainWindow from 'app/mainWindow/mainWindow';
import TabManager from 'app/tabs/tabManager';
import {BROWSER_HISTORY_PUSH, NOTIFICATION_CLICKED} from 'common/communication';

/**
 * Handle a mention notification click: notify the webapp and show/focus the
 * window after navigation completes.
 */
export function dispatchMentionClick(
    view: {id: string},
    webcontents: Electron.WebContents,
    channelId: string,
    teamId: string,
    url: string,
) {
    // Show the window after navigation has finished to avoid the focus handler
    // being called before the current channel has updated
    const focus = () => {
        MainWindow.show();
        TabManager.switchToTab(view.id);
        ipcMain.off(BROWSER_HISTORY_PUSH, focus);
    };
    ipcMain.on(BROWSER_HISTORY_PUSH, focus);
    webcontents.send(NOTIFICATION_CLICKED, channelId, teamId, url);
}
