// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {WebContents, WebFrameMain} from 'electron';

import type {
    DesktopThemeApplyRequest,
    DesktopThemeApplyResult,
    DesktopThemeDirective,
    DesktopThemeRejectReason,
    Theme,
} from '@mattermost/desktop-api';

import {isLightColor} from 'main/utils';

export function getFixedDesktopThemeNativeSource(centerChannelBg: string) {
    return isLightColor(centerChannelBg) ? 'light' as const : 'dark' as const;
}

export function getDesktopThemeNativeSource(directive: DesktopThemeDirective) {
    return directive.mode === 'system' ? 'system' as const : getFixedDesktopThemeNativeSource(directive.shellTheme.centerChannelBg);
}

export function desktopThemeDirectiveToTheme(directive: DesktopThemeDirective): Theme {
    return {
        ...directive.shellTheme,
        isUsingSystemTheme: directive.mode === 'system',
    };
}

export function rejectDesktopThemeApply(request: DesktopThemeApplyRequest, reason: DesktopThemeRejectReason): DesktopThemeApplyResult {
    return {
        status: 'rejected',
        surfaceId: request.surfaceId,
        leaseId: request.leaseId,
        sequence: request.sequence,
        reason,
    };
}

type DesktopThemeDocumentIdentity = {
    viewId: string;
    webContents: WebContents;
    frame: WebFrameMain;
};

export function isLiveDesktopThemeDocument(document: DesktopThemeDocumentIdentity) {
    return !document.webContents.isDestroyed() && !document.frame.isDestroyed() && !document.frame.detached && document.webContents.mainFrame === document.frame;
}

export function isSameDesktopThemeDocument(left?: DesktopThemeDocumentIdentity, right?: DesktopThemeDocumentIdentity) {
    return Boolean(left && right && left.viewId === right.viewId && left.webContents === right.webContents && left.frame === right.frame);
}
