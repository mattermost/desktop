// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface ExternalAPI {
    createListener(event: 'user-activity-update', listener: (
        userIsActive: boolean,
        idleTime: number,
        isSystemEvent: boolean,
    ) => void): () => void;
    createListener(event: 'notification-clicked', listener: (
        channelId: string,
        teamId: string,
        url: string,
    ) => void): () => void;
    createListener(event: 'browser-history-status-updated', listener: (
        canGoBack: boolean,
        canGoForward: boolean,
    ) => void): () => void;
    createListener(event: 'browser-history-push', listener: (path: string) => void): () => void;
    createListener(event: 'calls-widget-share-screen', listener: (sourceID: string, withAudio: boolean) => void): () => void;
    createListener(event: 'calls-join-request', listener: (callID: string) => void): () => void;
    createListener(event: 'calls-error', listener: (err: string, callID?: string, errMsg?: string) => void): () => void;
    createListener(event: 'desktop-sources-modal-request', listener: () => void): () => void;
}
