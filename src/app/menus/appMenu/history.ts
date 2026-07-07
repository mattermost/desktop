// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import TabManager from 'app/tabs/tabManager';
import WebContentsManager from 'app/views/webContentsManager';
import {localizeMessage} from 'main/i18nManager';

function getHistoryNavigationView() {
    return WebContentsManager.getFocusedView() ?? TabManager.getCurrentActiveTabView();
}

export default function createHistoryMenu() {
    return {
        id: 'history',
        label: localizeMessage('main.menus.app.history', '&History'),
        submenu: [{
            label: localizeMessage('main.menus.app.history.back', 'Back'),
            accelerator: process.platform === 'darwin' ? 'Cmd+[' : 'Alt+Left',
            click: () => {
                getHistoryNavigationView()?.goToOffset(-1);
            },
        }, {
            label: localizeMessage('main.menus.app.history.forward', 'Forward'),
            accelerator: process.platform === 'darwin' ? 'Cmd+]' : 'Alt+Right',
            click: () => {
                getHistoryNavigationView()?.goToOffset(1);
            },
        }],
    };
}
