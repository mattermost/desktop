// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BrowserWindow, Input, MenuItem, MenuItemConstructorOptions} from 'electron';
import {clipboard, Menu} from 'electron';

import WebContentsManager from 'app/views/webContentsManager';
import PopoutManager from 'app/windows/popoutManager';
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

    const template: Array<MenuItemConstructorOptions | MenuItem> = [
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
    ];

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

    if (isWindow) {
        template.push({
            type: 'separator',
        }, {
            label: localizeMessage('main.menus.popoutMenu.developerTools', 'Developer Tools'),
            submenu: [
                {
                    label: localizeMessage('main.menus.popoutMenu.developerToolsApplicationWrapper', 'Developer Tools for Application Wrapper'),
                    click() {
                        PopoutManager.getWindow(viewId)?.browserWindow.webContents.openDevTools({mode: 'detach'});
                    },
                },
                {
                    label: localizeMessage('main.menus.popoutMenu.developerToolsCurrentView', 'Developer Tools for Current View'),
                    click() {
                        WebContentsManager.getView(viewId)?.getWebContentsView().webContents.openDevTools({mode: 'detach'});
                    },
                },
            ],
        });
    }
    return template;
}

function createMenu(viewId: string) {
    // Electron is enforcing certain variables that it doesn't need
    return Menu.buildFromTemplate(createTemplate(viewId));
}

export function createSetNativeTitleBar(window: BrowserWindow, viewId: string) {
    return (event: Event, input: Input) => {
        if (input.key === 'Alt') {
            window.setMenu(Menu.buildFromTemplate([{
                label: localizeMessage('main.menus.popoutMenu.title', 'Popout Menu'),
                submenu: createTemplate(viewId) as MenuItemConstructorOptions[],
            }]));
        }
    };
}

export default function PopoutMenu(viewId: string) {
    const menu = createMenu(viewId);
    menu.once('menu-will-close', () => {
        WebContentsManager.getView(viewId)?.focus();
    });
    menu.popup();
}
