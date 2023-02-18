// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
export type CallsWidgetWindowConfig = {
    siteURL: string;
    callID: string;
    title: string;
    serverName: string;
    channelURL: string;
}

export type CallsJoinCallMessage = {
    callID: string;
    title: string;
    channelURL: string;
}

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
