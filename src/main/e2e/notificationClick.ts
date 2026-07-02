// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {webContents} from 'electron';

import WebContentsManager from 'app/views/webContentsManager';
import type {dispatchMentionClick} from 'main/notifications';

export type SimulateNotificationClickPayload = {
    webContentsId: number;
    channelId: string;
    teamId: string;
    url: string;
};

export function createSimulateNotificationClick(
    mentionClick: typeof dispatchMentionClick,
) {
    return (payload: SimulateNotificationClickPayload) => {
        const wc = webContents.fromId(payload.webContentsId);
        if (!wc || wc.isDestroyed()) {
            throw new Error(`webContents ${payload.webContentsId} is not available`);
        }

        const view = WebContentsManager.getViewByWebContentsId(wc.id);
        if (!view) {
            throw new Error(`No view for webContents ${payload.webContentsId}`);
        }

        mentionClick(view, wc, payload.channelId, payload.teamId, payload.url);
    };
}
