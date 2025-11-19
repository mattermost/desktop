// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserWindow} from 'electron';

import MainWindow from 'app/mainWindow/mainWindow';
import ServerHub from 'app/serverHub';
import TabManager from 'app/tabs/tabManager';
import PopoutManager from 'app/windows/popoutManager';
import Config from 'common/config';
import ServerManager from 'common/servers/serverManager';
import ViewManager from 'common/views/viewManager';
import {handleShowSettingsModal} from 'main/app/intercom';
import {localizeMessage} from 'main/i18nManager';

import {createAppMenu, createFileMenu} from './file';

jest.mock('electron', () => ({
    app: {
        name: 'AppName',
        getVersion: () => '5.0.0',
        getAppPath: () => '',
    },
    BrowserWindow: {
        getFocusedWindow: jest.fn(),
    },
}));

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));

jest.mock('common/servers/serverManager', () => ({
    hasServers: jest.fn(),
    getCurrentServerId: jest.fn(),
    getServer: jest.fn(),
}));

jest.mock('common/views/viewManager', () => ({
    isViewLimitReached: jest.fn(),
    createView: jest.fn(),
}));

jest.mock('app/tabs/tabManager', () => ({
    getOrderedTabsForServer: jest.fn(),
    switchToTab: jest.fn(),
}));

jest.mock('app/windows/popoutManager', () => ({
    createNewWindow: jest.fn(),
}));

jest.mock('app/mainWindow/mainWindow', () => ({
    get: jest.fn(),
}));

jest.mock('app/serverHub', () => ({
    showNewServerModal: jest.fn(),
}));

jest.mock('main/app/intercom', () => ({
    handleShowSettingsModal: jest.fn(),
}));

jest.mock('common/config', () => ({
    enableServerManagement: true,
}));

describe('app/menus/appMenu/file', () => {
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

    let originalPlatform;

    beforeEach(() => {
        originalPlatform = process.platform;
        ServerManager.getCurrentServerId.mockReturnValue(servers[0].id);
        ServerManager.getServer.mockReturnValue(servers[0]);
        ServerManager.hasServers.mockReturnValue(true);
        ViewManager.isViewLimitReached.mockReturnValue(false);
        TabManager.getOrderedTabsForServer.mockReturnValue([]);
        MainWindow.get.mockReturnValue({});
    });

    afterEach(() => {
        Object.defineProperty(process, 'platform', {
            value: originalPlatform,
        });
    });

    describe('createAppMenu', () => {
        let originalPlatform;
        beforeAll(() => {
            originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });
        });

        afterAll(() => {
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should have first menu name as AppName', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.file.about') {
                    return 'About AppName';
                }
                return id;
            });
            const menu = createAppMenu();
            expect(menu.label).toBe('&AppName');
        });

        it('should include About <appname> in menu on mac', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.file.about') {
                    return 'About AppName';
                }
                return id;
            });
            const menu = createAppMenu();
            const menuItem = menu.submenu.find((item) => item.label === 'About AppName');
            expect(menuItem).not.toBe(undefined);
            expect(menuItem.role).toBe('about');
        });

        it('should contain hide options', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.file') {
                    return '&AppName';
                }
                return id;
            });
            const menu = createAppMenu();
            expect(menu.submenu).toContainEqual(expect.objectContaining({role: 'hide'}));
            expect(menu.submenu).toContainEqual(expect.objectContaining({role: 'unhide'}));
            expect(menu.submenu).toContainEqual(expect.objectContaining({role: 'hideOthers'}));
        });
    });

    describe('createFileMenu', () => {
        it('should show `Sign in to Another Server` if `enableServerManagement` is true on non-macOS', () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            localizeMessage.mockImplementation((id) => {
                switch (id) {
                case 'main.menus.app.file':
                    return '&File';
                case 'main.menus.app.file.signInToAnotherServer':
                    return 'Sign in to Another Server';
                case 'main.menus.app.file.settings':
                    return 'Settings...';
                default:
                    return id;
                }
            });
            ServerManager.hasServers.mockReturnValue(true);
            Config.enableServerManagement = true;
            const menu = createFileMenu();
            const signInOption = menu.submenu.find((item) => item.label === 'Sign in to Another Server');
            expect(signInOption).not.toBe(undefined);
        });

        it('should not show `Sign in to Another Server` if `enableServerManagement` is false', () => {
            localizeMessage.mockImplementation((id) => {
                switch (id) {
                case 'main.menus.app.file':
                    return '&File';
                case 'main.menus.app.file.signInToAnotherServer':
                    return 'Sign in to Another Server';
                default:
                    return '';
                }
            });
            ServerManager.hasServers.mockReturnValue(true);
            Config.enableServerManagement = false;
            const menu = createFileMenu();
            const signInOption = menu.submenu.find((item) => item.label === 'Sign in to Another Server');
            expect(signInOption).toBe(undefined);
        });

        it('should not show `Sign in to Another Server` if no servers are configured', () => {
            localizeMessage.mockImplementation((id) => {
                switch (id) {
                case 'main.menus.app.file':
                    return '&File';
                case 'main.menus.app.file.signInToAnotherServer':
                    return 'Sign in to Another Server';
                default:
                    return '';
                }
            });
            ServerManager.hasServers.mockReturnValue(false);
            const menu = createFileMenu();
            const signInOption = menu.submenu.find((item) => item.label === 'Sign in to Another Server');
            expect(signInOption).toBe(undefined);
        });

        it('should include settings/preferences menu item on non-macOS', () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.file.settings') {
                    return 'Settings...';
                }
                return id;
            });
            const menu = createFileMenu();
            const settingsOption = menu.submenu.find((item) => item.label === 'Settings...');
            expect(settingsOption).not.toBe(undefined);
            expect(settingsOption.accelerator).toBe('CmdOrCtrl+,');
        });

        it('should call handleShowSettingsModal when settings is clicked', () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.file.settings') {
                    return 'Settings...';
                }
                return id;
            });
            const menu = createFileMenu();
            const settingsOption = menu.submenu.find((item) => item.label === 'Settings...');
            settingsOption.click();
            expect(handleShowSettingsModal).toHaveBeenCalled();
        });

        it('should call ServerHub.showNewServerModal when sign in to another server is clicked', () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            localizeMessage.mockImplementation((id) => {
                switch (id) {
                case 'main.menus.app.file':
                    return '&File';
                case 'main.menus.app.file.signInToAnotherServer':
                    return 'Sign in to Another Server';
                case 'main.menus.app.file.settings':
                    return 'Settings...';
                default:
                    return id;
                }
            });
            ServerManager.hasServers.mockReturnValue(true);
            Config.enableServerManagement = true;
            const menu = createFileMenu();
            const signInOption = menu.submenu.find((item) => item.label === 'Sign in to Another Server');
            expect(signInOption).not.toBe(undefined);
            signInOption.click();
            expect(ServerHub.showNewServerModal).toHaveBeenCalled();
        });

        it('should include new window option when server is available', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window.newWindow') {
                    return 'New Window';
                }
                return id;
            });
            const menu = createFileMenu();
            const newWindowOption = menu.submenu.find((item) => item.label === 'New Window');
            expect(newWindowOption).not.toBe(undefined);
            expect(newWindowOption.accelerator).toBe('CmdOrCtrl+N');
        });

        it('should call PopoutManager.createNewWindow when new window is clicked', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window.newWindow') {
                    return 'New Window';
                }
                return id;
            });
            const menu = createFileMenu();
            const newWindowOption = menu.submenu.find((item) => item.label === 'New Window');
            newWindowOption.click();
            expect(PopoutManager.createNewWindow).toHaveBeenCalledWith(servers[0].id);
        });

        it('should include new tab option when server is available', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window.newTab') {
                    return 'New Tab';
                }
                return id;
            });
            const menu = createFileMenu();
            const newTabOption = menu.submenu.find((item) => item.label === 'New Tab');
            expect(newTabOption).not.toBe(undefined);
            expect(newTabOption.accelerator).toBe('CmdOrCtrl+T');
        });

        it('should call TabManager.switchToTab when new tab is clicked', () => {
            const mockView = {id: 'view-1'};
            ViewManager.createView.mockReturnValue(mockView);
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window.newTab') {
                    return 'New Tab';
                }
                return id;
            });
            const menu = createFileMenu();
            const newTabOption = menu.submenu.find((item) => item.label === 'New Tab');
            newTabOption.click();
            expect(TabManager.switchToTab).toHaveBeenCalledWith(mockView.id);
        });

        it('should disable new window/tab when view limit is reached', () => {
            ViewManager.isViewLimitReached.mockReturnValue(true);
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window.newWindow') {
                    return 'New Window';
                }
                if (id === 'main.menus.app.window.newTab') {
                    return 'New Tab';
                }
                return id;
            });
            const menu = createFileMenu();
            const newWindowOption = menu.submenu.find((item) => item.label === 'New Window');
            const newTabOption = menu.submenu.find((item) => item.label === 'New Tab');
            expect(newWindowOption.enabled).toBe(false);
            expect(newTabOption.enabled).toBe(false);
        });

        it('should include hidden CmdOrCtrl+W accelerator when main window is focused and there are less than 2 tabs', () => {
            const mockMainWindow = {};
            MainWindow.get.mockReturnValue(mockMainWindow);
            BrowserWindow.getFocusedWindow.mockReturnValue(mockMainWindow);
            TabManager.getOrderedTabsForServer.mockReturnValue([{id: 'tab-1'}]);
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window.closeWindow') {
                    return 'Close Window';
                }
                return id;
            });
            const menu = createFileMenu();
            const hiddenCloseItem = menu.submenu.find((item) =>
                item.visible === false &&
                item.accelerator === 'CmdOrCtrl+W',
            );
            expect(hiddenCloseItem).not.toBe(undefined);
        });
    });
});
