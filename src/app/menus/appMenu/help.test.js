// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shell, clipboard} from 'electron';

import Config from 'common/config';
import ServerManager from 'common/servers/serverManager';
import UpdateManager from 'main/autoUpdater';
import Diagnostics from 'main/diagnostics';
import {localizeMessage} from 'main/i18nManager';

import createHelpMenu from './help';

jest.mock('electron', () => ({
    app: {
        getVersion: () => '5.0.0',
    },
    shell: {
        openExternal: jest.fn(),
        showItemInFolder: jest.fn(),
    },
    clipboard: {
        writeText: jest.fn(),
    },
}));

jest.mock('electron-log', () => ({
    transports: {
        file: {
            getFile: () => ({path: '/path/to/logs.log'}),
        },
    },
}));

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));

jest.mock('common/config', () => ({
    canUpgrade: false,
    helpLink: 'http://link-to-help.site.com',
    academyLink: 'http://academy.site.com',
}));

jest.mock('common/servers/serverManager', () => ({
    getCurrentServerId: jest.fn(),
    getServer: jest.fn(),
    getOrderedServers: jest.fn(),
    getRemoteInfo: jest.fn(),
}));

jest.mock('main/autoUpdater', () => ({
    versionDownloaded: false,
    versionAvailable: false,
    handleUpdate: jest.fn(),
    handleDownload: jest.fn(),
    checkForUpdates: jest.fn(),
}));

jest.mock('main/diagnostics', () => ({
    run: jest.fn(),
}));

describe('app/menus/appMenu/help', () => {
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

    beforeEach(() => {
        ServerManager.getCurrentServerId.mockReturnValue(servers[0].id);
        ServerManager.getServer.mockReturnValue(servers[0]);
        ServerManager.getOrderedServers.mockReturnValue(servers);
        ServerManager.getRemoteInfo.mockReturnValue({
            helpLink: 'http://server-help.com',
            reportProblemLink: 'http://server-report.com',
            licenseSku: 'professional',
            serverVersion: '7.0.0',
        });
        Config.canUpgrade = false;
        UpdateManager.versionDownloaded = false;
        UpdateManager.versionAvailable = false;
    });

    describe('createHelpMenu', () => {
        it('should show the "Run diagnostics" item under help', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.RunDiagnostics') {
                    return 'Run diagnostics';
                }
                return id;
            });
            const menu = createHelpMenu();
            const diagnosticsItem = menu.submenu.find((item) => item.id === 'diagnostics');
            expect(diagnosticsItem).not.toBe(undefined);
            expect(diagnosticsItem.label).toBe('Run diagnostics');
        });

        it('should call Diagnostics.run when diagnostics is clicked', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.RunDiagnostics') {
                    return 'Run diagnostics';
                }
                return id;
            });
            const menu = createHelpMenu();
            const diagnosticsItem = menu.submenu.find((item) => item.id === 'diagnostics');
            diagnosticsItem.click();
            expect(Diagnostics.run).toHaveBeenCalled();
        });

        it('should show user guide when help link is available', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.userGuide') {
                    return 'User guide';
                }
                return id;
            });
            const menu = createHelpMenu();
            const userGuideItem = menu.submenu.find((item) => item.label === 'User guide');
            expect(userGuideItem).not.toBe(undefined);
        });

        it('should call shell.openExternal with server help link when user guide is clicked', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.userGuide') {
                    return 'User guide';
                }
                return id;
            });
            const menu = createHelpMenu();
            const userGuideItem = menu.submenu.find((item) => item.label === 'User guide');
            userGuideItem.click();
            expect(shell.openExternal).toHaveBeenCalledWith('http://server-help.com');
        });

        it('should fall back to config help link when server help link is not available', () => {
            ServerManager.getRemoteInfo.mockReturnValue({});
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.userGuide') {
                    return 'User guide';
                }
                return id;
            });
            const menu = createHelpMenu();
            const userGuideItem = menu.submenu.find((item) => item.label === 'User guide');
            userGuideItem.click();
            expect(shell.openExternal).toHaveBeenCalledWith('http://link-to-help.site.com');
        });

        it('should show academy link when available', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.academy') {
                    return 'Mattermost Academy';
                }
                return id;
            });
            const menu = createHelpMenu();
            const academyItem = menu.submenu.find((item) => item.label === 'Mattermost Academy');
            expect(academyItem).not.toBe(undefined);
        });

        it('should call shell.openExternal with academy link when academy is clicked', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.academy') {
                    return 'Mattermost Academy';
                }
                return id;
            });
            const menu = createHelpMenu();
            const academyItem = menu.submenu.find((item) => item.label === 'Mattermost Academy');
            academyItem.click();
            expect(shell.openExternal).toHaveBeenCalledWith('http://academy.site.com');
        });

        it('should show logs option', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.ShowLogs') {
                    return 'Show logs';
                }
                return id;
            });
            const menu = createHelpMenu();
            const logsItem = menu.submenu.find((item) => item.id === 'Show logs');
            expect(logsItem).not.toBe(undefined);
        });

        it('should call shell.showItemInFolder when logs is clicked', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.ShowLogs') {
                    return 'Show logs';
                }
                return id;
            });
            const menu = createHelpMenu();
            const logsItem = menu.submenu.find((item) => item.id === 'Show logs');
            logsItem.click();
            expect(shell.showItemInFolder).toHaveBeenCalledWith('/path/to/logs.log');
        });

        it('should show report problem option', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.reportProblem') {
                    return 'Report a problem';
                }
                return id;
            });
            const menu = createHelpMenu();
            const reportProblemItem = menu.submenu.find((item) => item.label === 'Report a problem');
            expect(reportProblemItem).not.toBe(undefined);
        });

        it('should call shell.openExternal with server report problem link when report problem is clicked', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.reportProblem') {
                    return 'Report a problem';
                }
                return id;
            });
            const menu = createHelpMenu();
            const reportProblemItem = menu.submenu.find((item) => item.label === 'Report a problem');
            reportProblemItem.click();
            expect(shell.openExternal).toHaveBeenCalledWith('http://server-report.com');
        });

        it('should use default report problem link for enterprise license', () => {
            ServerManager.getRemoteInfo.mockReturnValue({
                licenseSku: 'enterprise',
            });
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.reportProblem') {
                    return 'Report a problem';
                }
                return id;
            });
            const menu = createHelpMenu();
            const reportProblemItem = menu.submenu.find((item) => item.label === 'Report a problem');
            reportProblemItem.click();
            expect(shell.openExternal).toHaveBeenCalledWith('https://support.mattermost.com/hc/en-us/requests/new');
        });

        it('should use default report problem link for team edition', () => {
            ServerManager.getRemoteInfo.mockReturnValue({
                licenseSku: 'team',
            });
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.reportProblem') {
                    return 'Report a problem';
                }
                return id;
            });
            const menu = createHelpMenu();
            const reportProblemItem = menu.submenu.find((item) => item.label === 'Report a problem');
            reportProblemItem.click();
            expect(shell.openExternal).toHaveBeenCalledWith('https://mattermost.com/pl/report-a-bug');
        });

        it('should show version information', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.versionString.desktop') {
                    return 'Desktop App Version 5.0.0';
                }
                return id;
            });
            const menu = createHelpMenu();
            const versionItem = menu.submenu.find((item) => item.label === 'Desktop App Version 5.0.0');
            expect(versionItem).not.toBe(undefined);
        });

        it('should call clipboard.writeText when version is clicked', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.versionString.desktop') {
                    return 'Desktop App Version 5.0.0';
                }
                return id;
            });
            const menu = createHelpMenu();
            const versionItem = menu.submenu.find((item) => item.label === 'Desktop App Version 5.0.0');
            versionItem.click();
            expect(clipboard.writeText).toHaveBeenCalledWith('Desktop App Version 5.0.0');
        });

        it('should show server version information for each server', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.versionString.server') {
                    return 'Server Version 7.0.0';
                }
                return id;
            });
            const menu = createHelpMenu();
            const serverVersionItem = menu.submenu.find((item) => item.label === '    Server Version 7.0.0');
            expect(serverVersionItem).not.toBe(undefined);
        });

        it('should call clipboard.writeText when server version is clicked', () => {
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.versionString.server') {
                    return 'Server Version 7.0.0';
                }
                return id;
            });
            const menu = createHelpMenu();
            const serverVersionItem = menu.submenu.find((item) => item.label === '    Server Version 7.0.0');
            serverVersionItem.click();
            expect(clipboard.writeText).toHaveBeenCalledWith('Server Version 7.0.0');
        });

        it('should show restart and update option when update is downloaded', () => {
            Config.canUpgrade = true;
            UpdateManager.versionDownloaded = true;
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.restartAndUpdate') {
                    return 'Restart and Update';
                }
                return id;
            });
            const menu = createHelpMenu();
            const restartUpdateItem = menu.submenu.find((item) => item.label === 'Restart and Update');
            expect(restartUpdateItem).not.toBe(undefined);
        });

        it('should call UpdateManager.handleUpdate when restart and update is clicked', () => {
            Config.canUpgrade = true;
            UpdateManager.versionDownloaded = true;
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.restartAndUpdate') {
                    return 'Restart and Update';
                }
                return id;
            });
            const menu = createHelpMenu();
            const restartUpdateItem = menu.submenu.find((item) => item.label === 'Restart and Update');
            restartUpdateItem.click();
            expect(UpdateManager.handleUpdate).toHaveBeenCalled();
        });

        it('should show download update option when update is available', () => {
            Config.canUpgrade = true;
            UpdateManager.versionAvailable = true;
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.downloadUpdate') {
                    return 'Download Update';
                }
                return id;
            });
            const menu = createHelpMenu();
            const downloadUpdateItem = menu.submenu.find((item) => item.label === 'Download Update');
            expect(downloadUpdateItem).not.toBe(undefined);
        });

        it('should call UpdateManager.handleDownload when download update is clicked', () => {
            Config.canUpgrade = true;
            UpdateManager.versionAvailable = true;
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.downloadUpdate') {
                    return 'Download Update';
                }
                return id;
            });
            const menu = createHelpMenu();
            const downloadUpdateItem = menu.submenu.find((item) => item.label === 'Download Update');
            downloadUpdateItem.click();
            expect(UpdateManager.handleDownload).toHaveBeenCalled();
        });

        it('should show check for updates option when no update is available', () => {
            Config.canUpgrade = true;
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.checkForUpdates') {
                    return 'Check for Updates';
                }
                return id;
            });
            const menu = createHelpMenu();
            const checkUpdatesItem = menu.submenu.find((item) => item.label === 'Check for Updates');
            expect(checkUpdatesItem).not.toBe(undefined);
        });

        it('should call UpdateManager.checkForUpdates when check for updates is clicked', () => {
            Config.canUpgrade = true;
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.checkForUpdates') {
                    return 'Check for Updates';
                }
                return id;
            });
            const menu = createHelpMenu();
            const checkUpdatesItem = menu.submenu.find((item) => item.label === 'Check for Updates');
            checkUpdatesItem.click();
            expect(UpdateManager.checkForUpdates).toHaveBeenCalledWith(true);
        });

        it('should not show update options when canUpgrade is false', () => {
            Config.canUpgrade = false;
            const menu = createHelpMenu();
            const restartUpdateItem = menu.submenu.find((item) => item.label === 'Restart and Update');
            const downloadUpdateItem = menu.submenu.find((item) => item.label === 'Download Update');
            const checkUpdatesItem = menu.submenu.find((item) => item.label === 'Check for Updates');
            expect(restartUpdateItem).toBe(undefined);
            expect(downloadUpdateItem).toBe(undefined);
            expect(checkUpdatesItem).toBe(undefined);
        });

        it('should show unavailable server version when server version is not available', () => {
            ServerManager.getRemoteInfo.mockReturnValue({});
            localizeMessage.mockImplementation((id) => {
                if (id === 'main.menus.app.help.versionString.server.unavailable') {
                    return 'Unavailable';
                }
                if (id === 'main.menus.app.help.versionString.server') {
                    return 'Server Version Unavailable';
                }
                return id;
            });
            const menu = createHelpMenu();
            const serverVersionItem = menu.submenu.find((item) => item.label === '    Server Version Unavailable');
            expect(serverVersionItem).not.toBe(undefined);
            expect(serverVersionItem.enabled).toBe(false);
        });
    });
});
