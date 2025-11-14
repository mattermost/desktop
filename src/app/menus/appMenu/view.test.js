// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import CallsWidgetWindow from 'app/callsWidgetWindow';
import MainWindow from 'app/mainWindow/mainWindow';
import TabManager from 'app/tabs/tabManager';
import WebContentsManager from 'app/views/webContentsManager';
import Config from 'common/config';
import ServerManager from 'common/servers/serverManager';
import {clearAllData, clearDataForServer} from 'main/app/utils';
import DeveloperMode from 'main/developerMode';
import downloadsManager from 'main/downloadsManager';
import {localizeMessage} from 'main/i18nManager';

import createViewMenu from './view';

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));

jest.mock('app/callsWidgetWindow', () => ({
    isOpen: jest.fn(),
    isPopoutOpen: jest.fn(),
    openDevTools: jest.fn(),
    openPopoutDevTools: jest.fn(),
}));

jest.mock('app/mainWindow/mainWindow', () => ({
    get: jest.fn(),
}));

jest.mock('app/tabs/tabManager', () => ({
    getCurrentActiveTabView: jest.fn(),
}));

jest.mock('app/views/webContentsManager', () => ({
    getFocusedView: jest.fn(),
    clearCacheAndReloadView: jest.fn(),
}));

jest.mock('common/config', () => ({
    darkMode: false,
    set: jest.fn(),
}));

jest.mock('common/servers/serverManager', () => ({
    getCurrentServerId: jest.fn(),
    getServer: jest.fn(),
}));

jest.mock('main/developerMode', () => ({
    enabled: jest.fn(),
    get: jest.fn(),
    toggle: jest.fn(),
}));

jest.mock('main/downloadsManager', () => ({
    hasDownloads: jest.fn(),
    openDownloadsDropdown: jest.fn(),
}));

jest.mock('main/app/utils', () => ({
    clearAllData: jest.fn(),
    clearDataForServer: jest.fn(),
}));

describe('app/menus/appMenu/view', () => {
    const mockView = {
        reload: jest.fn(),
        currentURL: 'https://example.com/current-page',
        openDevTools: jest.fn(),
    };

    const mockServer = {
        id: 'server-1',
        name: 'example',
        url: 'http://example.com',
    };

    beforeEach(() => {
        ServerManager.getCurrentServerId.mockReturnValue(mockServer.id);
        ServerManager.getServer.mockReturnValue(mockServer);
        WebContentsManager.getFocusedView.mockReturnValue(mockView);
        TabManager.getCurrentActiveTabView.mockReturnValue(mockView);
        CallsWidgetWindow.isOpen.mockReturnValue(false);
        CallsWidgetWindow.isPopoutOpen.mockReturnValue(false);
        DeveloperMode.enabled.mockReturnValue(false);
        downloadsManager.hasDownloads.mockReturnValue(false);
    });

    describe('createViewMenu', () => {
        it('should show developer tools submenu', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.view') {
                    return '&View';
                }
                if (id === 'main.menus.app.view.devToolsSubMenu') {
                    return 'Developer Tools';
                }
                if (id === 'main.menus.app.view.devToolsMainWindow') {
                    return 'Developer Tools for Main Window';
                }
                if (id === 'main.menus.app.view.devToolsCurrentTab') {
                    return 'Developer Tools for Current Tab';
                }
                return id;
            });

            const menu = createViewMenu();
            expect(menu.label).toBe('&View');

            const devToolsSubMenu = menu.submenu.find((item) => item.label === 'Developer Tools');
            expect(devToolsSubMenu).not.toBe(undefined);
            expect(devToolsSubMenu.submenu.length).toBe(2);
            expect(devToolsSubMenu.submenu[0].label).toBe('Developer Tools for Main Window');
            expect(devToolsSubMenu.submenu[1].label).toBe('Developer Tools for Current Tab');
        });

        it('should not show menu item if widget window is not open', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.view.devToolsCurrentCallWidget') {
                    return 'Developer Tools for Call Widget';
                }
                return id;
            });

            CallsWidgetWindow.isOpen.mockReturnValue(false);
            const menu = createViewMenu();
            const devToolsSubMenu = menu.submenu.find((item) => item.label === 'main.menus.app.view.devToolsSubMenu');
            expect(devToolsSubMenu).not.toBe(undefined);

            const menuItem = devToolsSubMenu.submenu.find((item) => item.label === 'main.menus.app.view.devToolsCurrentCallWidget');
            expect(menuItem).toBe(undefined);
        });

        it('should show menu item if widget window is open', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.view.devToolsSubMenu') {
                    return 'Developer Tools';
                }
                if (id === 'main.menus.app.view.devToolsCurrentCallWidget') {
                    return 'Developer Tools for Call Widget';
                }
                return id;
            });

            CallsWidgetWindow.isOpen.mockReturnValue(true);
            const menu = createViewMenu();
            const devToolsSubMenu = menu.submenu.find((item) => item.label === 'Developer Tools');
            expect(devToolsSubMenu).not.toBe(undefined);

            const menuItem = devToolsSubMenu.submenu.find((item) => item.label === 'Developer Tools for Call Widget');
            expect(menuItem).not.toBe(undefined);
        });

        it('should show additional menu item if widget popout is open', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.view.devToolsSubMenu') {
                    return 'Developer Tools';
                }
                if (id === 'main.menus.app.view.devToolsCurrentCallWidgetPopout') {
                    return 'Developer Tools for Call Widget Popout';
                }
                return id;
            });

            CallsWidgetWindow.isOpen.mockReturnValue(true);
            CallsWidgetWindow.isPopoutOpen.mockReturnValue(true);
            const menu = createViewMenu();
            const devToolsSubMenu = menu.submenu.find((item) => item.label === 'Developer Tools');
            expect(devToolsSubMenu).not.toBe(undefined);

            const menuItem = devToolsSubMenu.submenu.find((item) => item.label === 'Developer Tools for Call Widget Popout');
            expect(menuItem).not.toBe(undefined);
        });

        it('should call MainWindow.get().webContents.openDevTools when main window dev tools is clicked', () => {
            const mockWebContents = {openDevTools: jest.fn()};
            MainWindow.get.mockReturnValue({webContents: mockWebContents});

            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.view.devToolsMainWindow') {
                    return 'Developer Tools for Main Window';
                }
                return id;
            });

            const menu = createViewMenu();
            const devToolsSubMenu = menu.submenu.find((item) => item.label === 'main.menus.app.view.devToolsSubMenu');
            const mainWindowDevTools = devToolsSubMenu.submenu.find((item) => item.label === 'Developer Tools for Main Window');
            mainWindowDevTools.click();
            expect(mockWebContents.openDevTools).toHaveBeenCalledWith({mode: 'detach'});
        });

        it('should call TabManager.getCurrentActiveTabView().openDevTools when current tab dev tools is clicked', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.view.devToolsCurrentTab') {
                    return 'Developer Tools for Current Tab';
                }
                return id;
            });

            const menu = createViewMenu();
            const devToolsSubMenu = menu.submenu.find((item) => item.label === 'main.menus.app.view.devToolsSubMenu');
            const currentTabDevTools = devToolsSubMenu.submenu.find((item) => item.label === 'Developer Tools for Current Tab');
            currentTabDevTools.click();
            expect(mockView.openDevTools).toHaveBeenCalled();
        });

        it('should call CallsWidgetWindow.openDevTools when call widget dev tools is clicked', () => {
            CallsWidgetWindow.isOpen.mockReturnValue(true);

            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.view.devToolsSubMenu') {
                    return 'Developer Tools';
                }
                if (id === 'main.menus.app.view.devToolsCurrentCallWidget') {
                    return 'Developer Tools for Call Widget';
                }
                return id;
            });

            const menu = createViewMenu();
            const devToolsSubMenu = menu.submenu.find((item) => item.label === 'Developer Tools');
            const callWidgetDevTools = devToolsSubMenu.submenu.find((item) => item.label === 'Developer Tools for Call Widget');
            callWidgetDevTools.click();
            expect(CallsWidgetWindow.openDevTools).toHaveBeenCalled();
        });

        it('should call CallsWidgetWindow.openPopoutDevTools when call widget popout dev tools is clicked', () => {
            CallsWidgetWindow.isOpen.mockReturnValue(true);
            CallsWidgetWindow.isPopoutOpen.mockReturnValue(true);

            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.view.devToolsSubMenu') {
                    return 'Developer Tools';
                }
                if (id === 'main.menus.app.view.devToolsCurrentCallWidgetPopout') {
                    return 'Developer Tools for Call Widget Popout';
                }
                return id;
            });

            const menu = createViewMenu();
            const devToolsSubMenu = menu.submenu.find((item) => item.label === 'Developer Tools');
            const callWidgetPopoutDevTools = devToolsSubMenu.submenu.find((item) => item.label === 'Developer Tools for Call Widget Popout');
            callWidgetPopoutDevTools.click();
            expect(CallsWidgetWindow.openPopoutDevTools).toHaveBeenCalled();
        });

        it('should reload view with currentURL when reload menu item is clicked', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.view.reload') {
                    return 'Reload';
                }
                return id;
            });

            const menu = createViewMenu();
            const reloadMenuItem = menu.submenu.find((item) => item.label === 'Reload');
            expect(reloadMenuItem).not.toBe(undefined);
            reloadMenuItem.click();
            expect(mockView.reload).toHaveBeenCalledWith('https://example.com/current-page');
        });

        it('should reload view with currentURL when clear cache and reload menu item is clicked', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.view.clearCacheAndReload') {
                    return 'Clear Cache and Reload';
                }
                return id;
            });

            const menu = createViewMenu();
            const clearCacheMenuItem = menu.submenu.find((item) => item.label === 'Clear Cache and Reload');
            expect(clearCacheMenuItem).not.toBe(undefined);
            clearCacheMenuItem.click();
            expect(WebContentsManager.clearCacheAndReloadView).toHaveBeenCalledWith(mockView.id);
        });

        it('should handle reload when no focused view is available', () => {
            WebContentsManager.getFocusedView.mockReturnValue(null);

            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.view.reload') {
                    return 'Reload';
                }
                return id;
            });

            const menu = createViewMenu();
            const reloadMenuItem = menu.submenu.find((item) => item.label === 'Reload');
            expect(reloadMenuItem).not.toBe(undefined);

            // Should not throw an error when no view is available
            expect(() => reloadMenuItem.click()).not.toThrow();
        });

        it('should show developer mode options when developer mode is enabled', () => {
            DeveloperMode.enabled.mockReturnValue(true);
            DeveloperMode.get.mockImplementation((key) => {
                const values = {
                    browserOnly: false,
                    disableNotificationStorage: true,
                    disableUserActivityMonitor: false,
                    disableContextMenu: true,
                };
                return values[key];
            });

            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.view.developerModeBrowserOnly') {
                    return 'Browser Only Mode';
                }
                if (id === 'main.menus.app.view.developerModeDisableNotificationStorage') {
                    return 'Disable Notification Storage';
                }
                if (id === 'main.menus.app.view.developerModeDisableUserActivityMonitor') {
                    return 'Disable User Activity Monitor';
                }
                if (id === 'main.menus.app.view.developerModeDisableContextMenu') {
                    return 'Disable Context Menu';
                }
                return id;
            });

            const menu = createViewMenu();
            const devToolsSubMenu = menu.submenu.find((item) => item.label === 'main.menus.app.view.devToolsSubMenu');

            const browserOnlyOption = devToolsSubMenu.submenu.find((item) => item.label === 'Browser Only Mode');
            expect(browserOnlyOption).not.toBe(undefined);
            expect(browserOnlyOption.type).toBe('checkbox');
            expect(browserOnlyOption.checked).toBe(false);

            const disableNotificationStorageOption = devToolsSubMenu.submenu.find((item) => item.label === 'Disable Notification Storage');
            expect(disableNotificationStorageOption).not.toBe(undefined);
            expect(disableNotificationStorageOption.checked).toBe(true);
        });

        it('should call DeveloperMode.toggle when developer mode options are clicked', () => {
            DeveloperMode.enabled.mockReturnValue(true);
            DeveloperMode.get.mockReturnValue(false);

            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.view.developerModeBrowserOnly') {
                    return 'Browser Only Mode';
                }
                return id;
            });

            const menu = createViewMenu();
            const devToolsSubMenu = menu.submenu.find((item) => item.label === 'main.menus.app.view.devToolsSubMenu');
            const browserOnlyOption = devToolsSubMenu.submenu.find((item) => item.label === 'Browser Only Mode');
            browserOnlyOption.click();
            expect(DeveloperMode.toggle).toHaveBeenCalledWith('browserOnly');
        });

        it('should show downloads menu item when downloads are available', () => {
            downloadsManager.hasDownloads.mockReturnValue(true);

            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.view.downloads') {
                    return 'Downloads';
                }
                return id;
            });

            const menu = createViewMenu();
            const downloadsMenuItem = menu.submenu.find((item) => item.id === 'app-menu-downloads');
            expect(downloadsMenuItem).not.toBe(undefined);
            expect(downloadsMenuItem.enabled).toBe(true);
        });

        it('should call downloadsManager.openDownloadsDropdown when downloads is clicked', () => {
            downloadsManager.hasDownloads.mockReturnValue(true);

            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.view.downloads') {
                    return 'Downloads';
                }
                return id;
            });

            const menu = createViewMenu();
            const downloadsMenuItem = menu.submenu.find((item) => item.id === 'app-menu-downloads');
            downloadsMenuItem.click();
            expect(downloadsManager.openDownloadsDropdown).toHaveBeenCalled();
        });

        it('should show clear data for server option when server is available', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.view.clearDataForServer') {
                    return 'Clear Data for Current Server';
                }
                return id;
            });

            const menu = createViewMenu();
            const clearDataMenuItem = menu.submenu.find((item) => item.id === 'clear-data-for-server');
            expect(clearDataMenuItem).not.toBe(undefined);
        });

        it('should call clearDataForServer when clear data for server is clicked', async () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.view.clearDataForServer') {
                    return 'Clear Data for Current Server';
                }
                return id;
            });

            const menu = createViewMenu();
            const clearDataMenuItem = menu.submenu.find((item) => item.id === 'clear-data-for-server');
            await clearDataMenuItem.click();
            expect(clearDataForServer).toHaveBeenCalledWith(mockServer);
        });

        it('should show clear all data option', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.view.clearAllData') {
                    return 'Clear All Data';
                }
                return id;
            });

            const menu = createViewMenu();
            const clearAllDataMenuItem = menu.submenu.find((item) => item.id === 'clear-data');
            expect(clearAllDataMenuItem).not.toBe(undefined);
        });

        it('should call clearAllData when clear all data is clicked', async () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.view.clearAllData') {
                    return 'Clear All Data';
                }
                return id;
            });

            const menu = createViewMenu();
            const clearAllDataMenuItem = menu.submenu.find((item) => item.id === 'clear-data');
            await clearAllDataMenuItem.click();
            expect(clearAllData).toHaveBeenCalled();
        });

        it('should show toggle dark mode option on Linux', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'linux',
            });

            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.view.toggleDarkMode') {
                    return 'Toggle Dark Mode';
                }
                return id;
            });

            const menu = createViewMenu();
            const toggleDarkModeMenuItem = menu.submenu.find((item) => item.label === 'Toggle Dark Mode');
            expect(toggleDarkModeMenuItem).not.toBe(undefined);
            toggleDarkModeMenuItem.click();
            expect(Config.set).toHaveBeenCalledWith('darkMode', true);

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });
    });
});
