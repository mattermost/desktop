// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

declare namespace Electron {
    export interface IpcRenderer {
        on(event: 'user-activity-update', listener: (event: IpcMainEvent,
            userIsActive: boolean,
            idleTime: number,
            isSystemEvent: boolean,
        ) => void): this;
        on(event: 'notification-clicked', listener: (event: IpcMainEvent,
            channelId: string,
            teamId: string,
            url: string,
        ) => void): this;
        on(event: 'browser-history-status-updated', listener: (event: IpcMainEvent,
            canGoBack: boolean,
            canGoForward: boolean,
        ) => void): this;
        on(event: 'browser-history-push', listener: (event: IpcMainEvent, path: string) => void): this;
        on(event: 'calls-widget-share-screen', listener: (event: IpcMainEvent, sourceID: string, withAudio: boolean) => void): this;
        on(event: 'calls-join-request', listener: (event: IpcMainEvent, callID: string) => void): this;
        on(event: 'calls-error', listener: (event: IpcMainEvent, err: string, callID?: string, errMsg?: string) => void): this;
    }
}
