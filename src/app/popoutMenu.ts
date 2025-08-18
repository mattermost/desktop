// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MenuItem, MenuItemConstructorOptions} from 'electron';
import {clipboard, Menu} from 'electron';

import WebContentsManager from 'app/views/webContentsManager';
import {ViewType} from 'common/views/MattermostView';
import ViewManager from 'common/views/viewManager';
import {localizeMessage} from 'main/i18nManager';

import TabManager from './tabs/tabManager';

function createTemplate(viewId: string) {
    const view = ViewManager.getView(viewId);
    if (!view) {
        return [];
    }
    const isWindow = view.type === ViewType.WINDOW;
    const isLastTab = view.type === ViewType.TAB && TabManager.getOrderedTabsForServer(view.serverId).length === 1;

    const template = [
        {
            label: localizeMessage('main.menus.popoutMenu.copyLink', 'Copy Link'),
            click() {
                const webContentsView = WebContentsManager.getView(viewId);
                if (!webContentsView) {
                    return;
                }
                const url = webContentsView.getWebContentsView().webContents.getURL();
                clipboard.writeText(url);
            },
        },
    ] as Array<MenuItemConstructorOptions | MenuItem>;

    if (!isLastTab) {
        template.push(...[{
            type: 'separator' as const,
        },
        {
            label: isWindow ? localizeMessage('main.menus.popoutMenu.moveToMainWindow', 'Move to main window') : localizeMessage('main.menus.popoutMenu.moveToNewWindow', 'Move to new window'),
            click() {
                if (isWindow) {
                    ViewManager.updateViewType(viewId, ViewType.TAB);
                } else {
                    ViewManager.updateViewType(viewId, ViewType.WINDOW);
                }
            },
        },
        {
            label: isWindow ? localizeMessage('main.menus.popoutMenu.closeWindow', 'Close window') : localizeMessage('main.menus.popoutMenu.closeTab', 'Close tab'),
            click() {
                ViewManager.removeView(viewId);
            },
        }]);
    }
    return template;
}

function createMenu(viewId: string) {
    // Electron is enforcing certain variables that it doesn't need
    return Menu.buildFromTemplate(createTemplate(viewId) as Array<MenuItemConstructorOptions | MenuItem>);
}

export default function PopoutMenu(viewId: string) {
    const menu = createMenu(viewId);
    menu.popup();
}
