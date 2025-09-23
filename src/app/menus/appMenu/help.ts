// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shell, app, clipboard, type MenuItemConstructorOptions} from 'electron';
import log from 'electron-log';

import Config from 'common/config';
import {DEFAULT_EE_REPORT_PROBLEM_LINK, DEFAULT_TE_REPORT_PROBLEM_LINK} from 'common/constants';
import ServerManager from 'common/servers/serverManager';
import UpdateManager from 'main/autoUpdater';
import Diagnostics from 'main/diagnostics';
import {localizeMessage} from 'main/i18nManager';

export default function createHelpMenu(): MenuItemConstructorOptions {
    const submenu: MenuItemConstructorOptions[] = [];
    if (Config.canUpgrade) {
        if (UpdateManager.versionDownloaded) {
            submenu.push({
                label: localizeMessage('main.menus.app.help.restartAndUpdate', 'Restart and Update'),
                click() {
                    UpdateManager.handleUpdate();
                },
            });
        } else if (UpdateManager.versionAvailable) {
            submenu.push({
                label: localizeMessage('main.menus.app.help.downloadUpdate', 'Download Update'),
                click() {
                    UpdateManager.handleDownload();
                },
            });
        } else {
            submenu.push({
                label: localizeMessage('main.menus.app.help.checkForUpdates', 'Check for Updates'),
                click() {
                    UpdateManager.checkForUpdates(true);
                },
            });
        }
        submenu.push({type: 'separator'});
    }

    const serverId = ServerManager.getCurrentServerId();
    const currentServer = serverId ? ServerManager.getServer(serverId) : undefined;
    const currentRemoteInfo = currentServer ? ServerManager.getRemoteInfo(currentServer.id) : undefined;
    const helpLink = currentRemoteInfo?.helpLink ?? Config.helpLink;
    if (helpLink) {
        submenu.push({
            label: localizeMessage('main.menus.app.help.userGuide', 'User guide'),
            click() {
                shell.openExternal(helpLink);
            },
        });
    }
    const academyLink = Config.academyLink;
    if (academyLink) {
        submenu.push({
            label: localizeMessage('main.menus.app.help.academy', 'Mattermost Academy'),
            click() {
                shell.openExternal(academyLink);
            },
        });
    }
    submenu.push({type: 'separator'});

    submenu.push({
        id: 'Show logs',
        label: localizeMessage('main.menus.app.help.ShowLogs', 'Show logs'),
        click() {
            shell.showItemInFolder(log.transports.file.getFile().path);
        },
    });

    submenu.push({
        id: 'diagnostics',
        label: localizeMessage('main.menus.app.help.RunDiagnostics', 'Run diagnostics'),
        click() {
            Diagnostics.run();
        },
    });

    let reportProblemLink = currentRemoteInfo?.reportProblemLink;
    if (!reportProblemLink) {
        switch (currentRemoteInfo?.licenseSku) {
        case 'enterprise':
        case 'professional':
            reportProblemLink = DEFAULT_EE_REPORT_PROBLEM_LINK;
            break;
        default:
            reportProblemLink = DEFAULT_TE_REPORT_PROBLEM_LINK;
            break;
        }
    }
    if (reportProblemLink) {
        submenu.push({
            label: localizeMessage('main.menus.app.help.reportProblem', 'Report a problem'),
            click() {
                shell.openExternal(reportProblemLink!);
            },
        });
    }
    submenu.push({type: 'separator'});

    const version = localizeMessage('main.menus.app.help.versionString.desktop', 'Desktop App Version {version}{commit}', {
        version: app.getVersion(),
        // eslint-disable-next-line no-undef
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        commit: __HASH_VERSION__ ? localizeMessage('main.menus.app.help.commitString', ' commit: {hashVersion}', {hashVersion: __HASH_VERSION__}) : '',
    });
    submenu.push({
        label: version,
        click() {
            clipboard.writeText(version);
        },
    });

    ServerManager.getOrderedServers().forEach((server) => {
        submenu.push({
            label: server.name,
            enabled: false,
        });
        const version = ServerManager.getRemoteInfo(server.id)?.serverVersion;
        const versionLabel = localizeMessage('main.menus.app.help.versionString.server', 'Server Version {version}', {
            name: server.name,
            version: version ?? localizeMessage('main.menus.app.help.versionString.server.unavailable', 'Unavailable'),
        });
        submenu.push({
            label: `    ${versionLabel}`,
            enabled: version !== undefined,
            click() {
                if (version) {
                    clipboard.writeText(versionLabel);
                }
            },
        });
    });

    return {id: 'help', label: localizeMessage('main.menus.app.help', 'Hel&p'), submenu};
}
