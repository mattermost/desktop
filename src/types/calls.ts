// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
export type CallsWidgetWindowConfig = {
    callID: string;
    title: string;
    rootID: string;
    channelURL: string;
}

export type CallsJoinCallMessage = CallsWidgetWindowConfig;

export type CallsWidgetResizeMessage = {
    element: string;
    width: number;
    height: number;
}

export type CallsWidgetShareScreenMessage = {
    sourceID: string;
    withAudio: boolean;
}

export type CallsJoinedCallMessage = {
    callID: string;
}

export type CallsErrorMessage = {
    err: string;
    callID?: string;
    errMsg?: string;
}

export type CallsLinkClickMessage = {
    link: string | URL;
}

export type CallsJoinRequestMessage = {
    callID: string;
}

export type CallsEventHandler = ((viewName: string, msg: any) => void) | ((viewName: string, opts: Electron.SourcesOptions) => Promise<void>);
