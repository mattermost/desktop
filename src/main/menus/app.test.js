// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {getDoNotDisturb as getDarwinDoNotDisturb} from 'macos-notification-state';

import ServerViewState from 'app/serverViewState';
import ServerManager from 'common/servers/serverManager';
import {localizeMessage} from 'main/i18nManager';
import CallsWidgetWindow from 'main/windows/callsWidgetWindow';

import {createTemplate} from './app';

jest.mock('electron-devtools-installer', () => {
    return () => ({
        REACT_DEVELOPER_TOOLS: 'react-developer-tools',
    });
});

jest.mock('electron-context-menu', () => {
    return () => jest.fn();
});

jest.mock('electron-is-dev', () => false);

jest.mock('electron', () => {
    class NotificationMock {
        static isSupported = jest.fn();
        static didConstruct = jest.fn();
        constructor() {
            NotificationMock.didConstruct();
        }
        on = jest.fn();
        show = jest.fn();
        click = jest.fn();
        close = jest.fn();
    }
    return {
        app: {
            name: 'AppName',
            getVersion: () => '5.0.0',
            getAppPath: () => '',
        },
        ipcMain: {
            emit: jest.fn(),
            handle: jest.fn(),
            on: jest.fn(),
            removeHandler: jest.fn(),
            removeListener: jest.fn(),
        },
        Notification: NotificationMock,
        nativeImage: {
            createFromPath: jest.fn(),
        },
    };
});
jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(false),
    readFileSync: jest.fn().mockImplementation((text) => text),
    writeFile: jest.fn(),
}));
jest.mock('macos-notification-state', () => ({
    getDoNotDisturb: jest.fn(),
}));
jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));
jest.mock('common/servers/serverManager', () => ({
    hasServers: jest.fn(),
    getOrderedServers: jest.fn(),
    getOrderedTabsForServer: jest.fn(),
    getRemoteInfo: jest.fn(),
}));
jest.mock('app/serverViewState', () => ({
    switchServer: jest.fn(),
    getCurrentServer: jest.fn(),
}));
jest.mock('main/app/utils', () => ({}));
jest.mock('main/diagnostics', () => ({}));
jest.mock('main/downloadsManager', () => ({
    hasDownloads: jest.fn(),
}));
jest.mock('main/views/viewManager', () => ({}));
jest.mock('main/windows/mainWindow', () => ({
    get: jest.fn(),
}));
jest.mock('common/views/View', () => ({
    getViewDisplayName: (name) => name,
}));
jest.mock('main/AutoLauncher', () => ({
    enable: jest.fn(),
    disable: jest.fn(),
}));
jest.mock('main/windows/callsWidgetWindow', () => ({
    isOpen: jest.fn(),
}));
jest.mock('main/views/modalManager', () => ({
    addModal: jest.fn(),
}));

describe('main/menus/app', () => {
    const config = {
        enableServerManagement: true,
        helpLink: 'http://link-to-help.site.com',
    };
    const servers = [
        {
            id: 'server-1',
            name: 'example',
            url: 'http://example.com',
        },
        {
            id: 'server-2',
            name: 'github',
            url: 'https:/ /github.com/',
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
        ServerViewState.getCurrentServer.mockReturnValue(servers[0]);
        ServerManager.getOrderedServers.mockReturnValue(servers);
        ServerManager.getOrderedTabsForServer.mockReturnValue(views);
        getDarwinDoNotDisturb.mockReturnValue(false);
    });

    describe('mac only', () => {
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
            const menu = createTemplate(config);
            const appNameMenu = menu.find((item) => item.label === '&AppName');
            expect(appNameMenu).not.toBe(undefined);
        });

        it('should include About <appname> in menu on mac', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.file.about') {
                    return 'About AppName';
                }
                return id;
            });
            const menu = createTemplate(config);
            const appNameMenu = menu.find((item) => item.label === '&AppName');
            const menuItem = appNameMenu.submenu.find((item) => item.label === 'About AppName');
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
            const menu = createTemplate(config);
            const appNameMenu = menu.find((item) => item.label === '&AppName');
            expect(appNameMenu.submenu).toContainEqual(expect.objectContaining({role: 'hide'}));
            expect(appNameMenu.submenu).toContainEqual(expect.objectContaining({role: 'unhide'}));
            expect(appNameMenu.submenu).toContainEqual(expect.objectContaining({role: 'hideOthers'}));
        });

        it('should contain zoom and front options in Window', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.window') {
                    return '&Window';
                }
                return id;
            });
            const menu = createTemplate(config);
            const windowMenu = menu.find((item) => item.label === '&Window');
            expect(windowMenu.role).toBe('windowMenu');
            expect(windowMenu.submenu).toContainEqual(expect.objectContaining({role: 'zoom'}));
            expect(windowMenu.submenu).toContainEqual(expect.objectContaining({role: 'front'}));
        });
    });

    it('should show `Sign in to Another Server` if `enableServerManagement` is true', () => {
        localizeMessage.mockImplementation((id) => {
            switch (id) {
            case 'main.menus.app.file':
                return '&File';
            case 'main.menus.app.file.signInToAnotherServer':
                return 'Sign in to Another Server';
            default:
                return id;
            }
        });
        ServerManager.hasServers.mockReturnValue(true);
        const menu = createTemplate(config);
        const fileMenu = menu.find((item) => item.label === '&AppName' || item.label === '&File');
        const signInOption = fileMenu.submenu.find((item) => item.label === 'Sign in to Another Server');
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
        const modifiedConfig = {
            ...config,
            enableServerManagement: false,
        };
        const menu = createTemplate(modifiedConfig);
        const fileMenu = menu.find((item) => item.label === '&AppName' || item.label === '&File');
        const signInOption = fileMenu.submenu.find((item) => item.label === 'Sign in to Another Server');
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
        const menu = createTemplate(config);
        const fileMenu = menu.find((item) => item.label === '&AppName' || item.label === '&File');
        const signInOption = fileMenu.submenu.find((item) => item.label === 'Sign in to Another Server');
        expect(signInOption).toBe(undefined);
    });

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
        ServerManager.getOrderedServers.mockReturnValue(modifiedServers);
        ServerManager.getOrderedTabsForServer.mockReturnValue(modifiedViews);
        const menu = createTemplate(config);
        const windowMenu = menu.find((item) => item.label === '&Window');
        for (let i = 0; i < 9; i++) {
            const menuItem = windowMenu.submenu.find((item) => item.label === `server-${i}`);
            expect(menuItem).not.toBe(undefined);
        }
        for (let i = 9; i < 15; i++) {
            const menuItem = windowMenu.submenu.find((item) => item.label === `server-${i}`);
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
        ServerViewState.getCurrentServer.mockImplementation(() => ({id: servers[0].id}));

        const modifiedViews = [...Array(15).keys()].map((key) => ({
            id: `view-${key}`,
            type: `view-${key}`,
            isOpen: true,
        }));
        ServerManager.getOrderedTabsForServer.mockReturnValue(modifiedViews);
        const menu = createTemplate(config);
        const windowMenu = menu.find((item) => item.label === '&Window');
        for (let i = 0; i < 9; i++) {
            const menuItem = windowMenu.submenu.find((item) => item.label === `    view-${i}`);
            expect(menuItem).not.toBe(undefined);
        }
        for (let i = 9; i < 15; i++) {
            const menuItem = windowMenu.submenu.find((item) => item.label === `    view-${i}`);
            expect(menuItem).toBe(undefined);
        }
    });

    it('should show the "Run diagnostics" item under help', () => {
        const menu = createTemplate(config);
        const helpSubmenu = menu.find((subMenu) => subMenu.id === 'help')?.submenu;
        expect(helpSubmenu).toContainObject({id: 'diagnostics'});
    });

    it('should show developer tools submenu', () => {
        const menu = createTemplate(config);

        const appMenu = menu.find((item) => item.label === 'main.menus.app.view');

        expect(appMenu).not.toBe(undefined);

        const devToolsSubMenu = appMenu.submenu.find((item) => item.label === 'main.menus.app.view.devToolsSubMenu');

        expect(devToolsSubMenu.submenu.length).toBe(2);
        expect(devToolsSubMenu.submenu[0].label).toBe('main.menus.app.view.devToolsAppWrapper');
        expect(devToolsSubMenu.submenu[1].label).toBe('main.menus.app.view.devToolsCurrentServer');
    });

    it('should not show menu item if widget window is not open', () => {
        const menu = createTemplate(config);

        const appMenu = menu.find((item) => item.label === 'main.menus.app.view');
        expect(appMenu).not.toBe(undefined);

        const devToolsSubMenu = appMenu.submenu.find((item) => item.label === 'main.menus.app.view.devToolsSubMenu');
        expect(devToolsSubMenu).not.toBe(undefined);

        const menuItem = devToolsSubMenu.submenu.find((item) => item.label === 'main.menus.app.view.devToolsCurrentCallWidget');
        expect(menuItem).toBe(undefined);
    });

    it('should show menu item if widget window is open', () => {
        CallsWidgetWindow.isOpen = jest.fn(() => true);
        CallsWidgetWindow.isPopoutOpen = jest.fn(() => false);
        const menu = createTemplate(config);

        const appMenu = menu.find((item) => item.label === 'main.menus.app.view');
        expect(appMenu).not.toBe(undefined);

        const devToolsSubMenu = appMenu.submenu.find((item) => item.label === 'main.menus.app.view.devToolsSubMenu');
        expect(devToolsSubMenu).not.toBe(undefined);

        const menuItem = devToolsSubMenu.submenu.find((item) => item.label === 'main.menus.app.view.devToolsCurrentCallWidget');
        expect(menuItem).not.toBe(undefined);
    });

    it('should show additional menu item if widget popout is open', () => {
        CallsWidgetWindow.isOpen = jest.fn(() => true);
        CallsWidgetWindow.isPopoutOpen = jest.fn(() => true);
        const menu = createTemplate(config);

        const appMenu = menu.find((item) => item.label === 'main.menus.app.view');
        expect(appMenu).not.toBe(undefined);

        const devToolsSubMenu = appMenu.submenu.find((item) => item.label === 'main.menus.app.view.devToolsSubMenu');
        expect(devToolsSubMenu).not.toBe(undefined);

        const menuItem = devToolsSubMenu.submenu.find((item) => item.label === 'main.menus.app.view.devToolsCurrentCallWidgetPopout');
        expect(menuItem).not.toBe(undefined);
    });
});
