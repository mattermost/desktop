// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcMain, Menu, type MenuItemConstructorOptions} from 'electron';

import MainWindow from 'app/mainWindow/mainWindow';
import Tray from 'app/system/tray/tray';
import TabManager from 'app/tabs/tabManager';
import {
    DEVELOPER_MODE_UPDATED,
    EMIT_CONFIGURATION,
    MAIN_WINDOW_FOCUSED,
    TAB_ADDED,
    TAB_ORDER_UPDATED,
    TAB_REMOVED,
    UPDATE_SHORTCUT_MENU,
    VIEW_TITLE_UPDATED,
} from 'common/communication';
import ViewManager from 'common/views/viewManager';
import {shouldShowTrayIcon} from 'main/app/utils';
import DeveloperMode from 'main/developerMode';

import createEditMenu from './appMenu/edit';
import {createAppMenu, createFileMenu} from './appMenu/file';
import createHelpMenu from './appMenu/help';
import createHistoryMenu from './appMenu/history';
import createViewMenu from './appMenu/view';
import createWindowMenu from './appMenu/window';
import createTrayMenu from './tray';

export class MenuManager {
    constructor() {
        ipcMain.on(UPDATE_SHORTCUT_MENU, this.refreshMenu);
        ipcMain.on(EMIT_CONFIGURATION, this.refreshMenu);

        DeveloperMode.on(DEVELOPER_MODE_UPDATED, this.refreshMenu);
        TabManager.on(TAB_ADDED, this.refreshMenu);
        TabManager.on(TAB_REMOVED, this.refreshMenu);
        TabManager.on(TAB_ORDER_UPDATED, this.refreshMenu);
        ViewManager.on(VIEW_TITLE_UPDATED, this.refreshMenu);
        MainWindow.on(MAIN_WINDOW_FOCUSED, this.refreshMenu);
    }

    refreshMenu = () => {
        const appMenuTemplate: MenuItemConstructorOptions[] = [];

        if (process.platform === 'darwin') {
            appMenuTemplate.push(createAppMenu());
        }
        appMenuTemplate.push(
            createFileMenu(),
            createEditMenu(),
            createViewMenu(),
            createHistoryMenu(),
            createWindowMenu(),
            createHelpMenu(),
        );

        Menu.setApplicationMenu(Menu.buildFromTemplate(appMenuTemplate));

        // set up context menu for tray icon
        if (shouldShowTrayIcon()) {
            Tray.setMenu(createTrayMenu());
        }
    };
}

const menuManager = new MenuManager();
export default menuManager;
