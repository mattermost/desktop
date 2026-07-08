// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {localizeMessage} from 'main/i18nManager';

import {getFocusedOrActiveTabView} from './menuTargetView';

export default function createHistoryMenu() {
    return {
        id: 'history',
        label: localizeMessage('main.menus.app.history', '&History'),
        submenu: [{
            label: localizeMessage('main.menus.app.history.back', 'Back'),
            accelerator: process.platform === 'darwin' ? 'Cmd+[' : 'Alt+Left',
            click: () => {
                getFocusedOrActiveTabView()?.goToOffset(-1);
            },
        }, {
            label: localizeMessage('main.menus.app.history.forward', 'Forward'),
            accelerator: process.platform === 'darwin' ? 'Cmd+]' : 'Alt+Right',
            click: () => {
                getFocusedOrActiveTabView()?.goToOffset(1);
            },
        }],
    };
}
