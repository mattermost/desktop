// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcMain} from 'electron';

import TabManager from 'app/tabs/tabManager';
import ServerManager from 'common/servers/serverManager';
import ViewManager from 'common/views/viewManager';
import {localizeMessage} from 'main/i18nManager';

import createWindowMenu from './window';

jest.mock('electron', () => ({
    ipcMain: {
        emit: jest.fn(),
    },
}));

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));

jest.mock('common/servers/serverManager', () => ({
    hasServers: jest.fn(),
    getCurrentServerId: jest.fn(),
    getOrderedServers: jest.fn(),
    updateCurrentServer: jest.fn(),
}));

jest.mock('app/tabs/tabManager', () => ({
    getOrderedTabsForServer: jest.fn(),
    switchToTab: jest.fn(),
    switchToNextTab: jest.fn(),
    switchToPreviousTab: jest.fn(),
}));

jest.mock('common/views/viewManager', () => ({
    getViewTitle: jest.fn(),
}));

describe('app/menus/appMenu/window', () => {
    const servers = [
        {
            id: 'server-1',
            name: 'example',
            url: 'http://example.com',
        },
        {
            id: 'server-2',
            name: 'github',
            url: 'https://github.com/',
        },
    ];

    const views = [
        {
            id: 'view-1',
            name: 'TAB_MESSAGING',
            isOpen: true,
        },
        {
            id: 'view-2',
            name: 'TAB_FOCALBOARD',
            isOpen: true,
        },
        {
            id: 'view-3',
            name: 'TAB_PLAYBOOKS',
            isOpen: true,
        },
    ];

    beforeEach(() => {
        ServerManager.getCurrentServerId.mockReturnValue(servers[0].id);
        ServerManager.getOrderedServers.mockReturnValue(servers);
        TabManager.getOrderedTabsForServer.mockReturnValue(views);
        ViewManager.getViewTitle.mockImplementation((viewId) => `${viewId}`);
    });

    describe('createWindowMenu', () => {
        it('should show the first 9 servers (using order) in the Window menu', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window') {
                    return '&Window';
                }
                return id;
            });
            const modifiedServers = [...Array(15).keys()].map((key) => ({
                id: `server-${key}`,
                name: `server-${key}`,
                url: `http://server-${key}.com`,
            }));
            const modifiedViews = [
                {
                    id: 'view-1',
                    type: 'TAB_MESSAGING',
                    isOpen: true,
                },
            ];
            ServerManager.hasServers.mockReturnValue(true);
            ServerManager.getOrderedServers.mockReturnValue(modifiedServers);
            TabManager.getOrderedTabsForServer.mockReturnValue(modifiedViews);
            const menu = createWindowMenu();
            const windowMenu = menu.submenu;
            for (let i = 0; i < 9; i++) {
                const menuItem = windowMenu.find((item) => item.label === `server-${i}`);
                expect(menuItem).not.toBe(undefined);
            }
            for (let i = 9; i < 15; i++) {
                const menuItem = windowMenu.find((item) => item.label === `server-${i}`);
                expect(menuItem).toBe(undefined);
            }
        });

        it('should show the first 9 views (using order) in the Window menu', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window') {
                    return '&Window';
                }
                if (id.startsWith('common.views')) {
                    return id.replace('common.views.', '');
                }
                return id;
            });
            ServerManager.hasServers.mockReturnValue(true);
            ServerManager.getCurrentServerId.mockReturnValue(servers[0].id);

            const modifiedViews = [...Array(15).keys()].map((key) => ({
                id: `view-${key}`,
                title: `view-${key}`,
                type: `view-${key}`,
                isOpen: true,
            }));
            ViewManager.getViewTitle.mockImplementation((viewId) => `${viewId}`);
            TabManager.getOrderedTabsForServer.mockReturnValue(modifiedViews);
            const menu = createWindowMenu();
            const windowMenu = menu.submenu;
            for (let i = 0; i < 9; i++) {
                const menuItem = windowMenu.find((item) => item.label === `    view-${i}`);
                expect(menuItem).not.toBe(undefined);
            }
            for (let i = 9; i < 15; i++) {
                const menuItem = windowMenu.find((item) => item.label === `    view-${i}`);
                expect(menuItem).toBe(undefined);
            }
        });

        it('should contain zoom and front options in Window on macOS', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });

            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window') {
                    return '&Window';
                }
                return id;
            });
            ServerManager.hasServers.mockReturnValue(true);
            const menu = createWindowMenu();
            expect(menu.role).toBe('windowMenu');
            expect(menu.submenu).toContainEqual(expect.objectContaining({role: 'zoom'}));
            expect(menu.submenu).toContainEqual(expect.objectContaining({role: 'front'}));

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should show minimize option', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window.minimize') {
                    return 'Minimize';
                }
                return id;
            });
            const menu = createWindowMenu();
            const minimizeItem = menu.submenu.find((item) => item.role === 'minimize');
            expect(minimizeItem).not.toBe(undefined);
        });

        it('should show servers dropdown option when servers are available', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window.showServers') {
                    return 'Show Servers';
                }
                return id;
            });
            ServerManager.hasServers.mockReturnValue(true);
            const menu = createWindowMenu();
            const showServersItem = menu.submenu.find((item) => item.label === 'Show Servers');
            expect(showServersItem).not.toBe(undefined);
        });

        it('should call ipcMain.emit when show servers is clicked', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window.showServers') {
                    return 'Show Servers';
                }
                return id;
            });
            ServerManager.hasServers.mockReturnValue(true);
            const menu = createWindowMenu();
            const showServersItem = menu.submenu.find((item) => item.label === 'Show Servers');
            showServersItem.click();
            expect(ipcMain.emit).toHaveBeenCalledWith('open-servers-dropdown');
        });

        it('should call ServerManager.updateCurrentServer when server is clicked', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window') {
                    return '&Window';
                }
                return id;
            });
            ServerManager.hasServers.mockReturnValue(true);
            const menu = createWindowMenu();
            const serverItem = menu.submenu.find((item) => item.label === 'example');
            expect(serverItem).not.toBe(undefined);
            serverItem.click();
            expect(ServerManager.updateCurrentServer).toHaveBeenCalledWith(servers[0].id);
        });

        it('should call TabManager.switchToTab when view is clicked', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window') {
                    return '&Window';
                }
                return id;
            });
            ServerManager.hasServers.mockReturnValue(true);
            const menu = createWindowMenu();
            const viewItem = menu.submenu.find((item) => item.label === '    view-1');
            expect(viewItem).not.toBe(undefined);
            viewItem.click();
            expect(TabManager.switchToTab).toHaveBeenCalledWith('view-1');
        });

        it('should show tab navigation options when server is available', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window.selectNextTab') {
                    return 'Select Next Tab';
                }
                if (id === 'main.menus.app.window.selectPreviousTab') {
                    return 'Select Previous Tab';
                }
                return id;
            });
            ServerManager.hasServers.mockReturnValue(true);
            const menu = createWindowMenu();
            const nextTabItem = menu.submenu.find((item) => item.label === 'Select Next Tab');
            const prevTabItem = menu.submenu.find((item) => item.label === 'Select Previous Tab');
            expect(nextTabItem).not.toBe(undefined);
            expect(prevTabItem).not.toBe(undefined);
        });

        it('should call TabManager.switchToNextTab when next tab is clicked', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window.selectNextTab') {
                    return 'Select Next Tab';
                }
                return id;
            });
            ServerManager.hasServers.mockReturnValue(true);
            const menu = createWindowMenu();
            const nextTabItem = menu.submenu.find((item) => item.label === 'Select Next Tab');
            nextTabItem.click();
            expect(TabManager.switchToNextTab).toHaveBeenCalled();
        });

        it('should call TabManager.switchToPreviousTab when previous tab is clicked', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window.selectPreviousTab') {
                    return 'Select Previous Tab';
                }
                return id;
            });
            ServerManager.hasServers.mockReturnValue(true);
            const menu = createWindowMenu();
            const prevTabItem = menu.submenu.find((item) => item.label === 'Select Previous Tab');
            prevTabItem.click();
            expect(TabManager.switchToPreviousTab).toHaveBeenCalled();
        });

        it('should show bring all to front option on macOS', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });

            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window.bringAllToFront') {
                    return 'Bring All to Front';
                }
                return id;
            });
            const menu = createWindowMenu();
            const bringAllToFrontItem = menu.submenu.find((item) => item.role === 'front');
            expect(bringAllToFrontItem).not.toBe(undefined);

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should set correct accelerators for different platforms', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window.showServers') {
                    return 'Show Servers';
                }
                return id;
            });
            ServerManager.hasServers.mockReturnValue(true);

            // Test macOS accelerator
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });
            const macMenu = createWindowMenu();
            const macShowServersItem = macMenu.submenu.find((item) => item.label === 'Show Servers');
            expect(macShowServersItem.accelerator).toBe('Cmd+Ctrl+S');

            // Test Windows accelerator
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });
            const winMenu = createWindowMenu();
            const winShowServersItem = winMenu.submenu.find((item) => item.label === 'Show Servers');
            expect(winShowServersItem.accelerator).toBe('Ctrl+Shift+S');

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should not show servers option when no servers are available', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window.showServers') {
                    return 'Show Servers';
                }
                return id;
            });
            ServerManager.hasServers.mockReturnValue(false);
            const menu = createWindowMenu();
            const showServersItem = menu.submenu.find((item) => item.label === 'Show Servers');
            expect(showServersItem).toBe(undefined);
        });

        it('should not show tab navigation when no server is current', () => {
            ServerManager.getCurrentServerId.mockReturnValue(null);
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window.selectNextTab') {
                    return 'Select Next Tab';
                }
                if (id === 'main.menus.app.window.selectPreviousTab') {
                    return 'Select Previous Tab';
                }
                return id;
            });
            const menu = createWindowMenu();
            const nextTabItem = menu.submenu.find((item) => item.label === 'Select Next Tab');
            const prevTabItem = menu.submenu.find((item) => item.label === 'Select Previous Tab');
            expect(nextTabItem).toBe(undefined);
            expect(prevTabItem).toBe(undefined);
        });
    });
});
