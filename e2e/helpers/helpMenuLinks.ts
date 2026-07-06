// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

export type HelpMenuRemoteInfoPatch = {
    helpLink?: string;
    reportProblemLink?: string;
    serverVersion?: string;
};

export async function patchHelpMenuRemoteInfo(
    app: ElectronApplication,
    patch: HelpMenuRemoteInfoPatch,
): Promise<void> {
    await app.evaluate(({ipcMain}, payload) => {
        const refs = (global as any).__e2eTestRefs;
        const serverId = refs?.ServerManager?.getCurrentServerId?.();
        if (!serverId) {
            throw new Error('No current server is registered');
        }

        const existing = refs.ServerManager.getRemoteInfo(serverId) ?? {};
        const nextRemoteInfo = {
            ...existing,
            serverVersion: payload.serverVersion ?? existing.serverVersion ?? '10.0.0',
        };
        if (payload.helpLink !== undefined) {
            nextRemoteInfo.helpLink = payload.helpLink;
        }
        if (payload.reportProblemLink !== undefined) {
            nextRemoteInfo.reportProblemLink = payload.reportProblemLink;
        }
        refs.ServerManager.updateRemoteInfo(serverId, nextRemoteInfo);

        const configData = refs.Config?.data ?? refs.Config?.combinedData;
        if (!configData) {
            throw new Error('Config.data is not available for menu refresh');
        }

        ipcMain.emit('emit-configuration', null, configData);
    }, patch);
}

export async function getHelpSubmenuLabels(app: ElectronApplication): Promise<string[]> {
    return app.evaluate(({app: electronApp}) => {
        const helpMenu = electronApp.applicationMenu?.getMenuItemById('help');
        const labels: string[] = [];
        const stack = [...(helpMenu?.submenu?.items ?? [])];

        while (stack.length) {
            const item = stack.shift();
            if (!item) {
                continue;
            }
            if (typeof item.label === 'string') {
                labels.push(item.label.trim());
            }
            if (item.submenu?.items?.length) {
                stack.push(...item.submenu.items);
            }
        }

        return labels;
    });
}
