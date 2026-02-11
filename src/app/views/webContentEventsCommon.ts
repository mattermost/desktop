// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import path from 'path';

import type {Event, WebContentsConsoleMessageEventParams} from 'electron';

import {MATTERMOST_PROTOCOL} from 'common/constants';
import type {Logger} from 'common/log';
import {getLevel} from 'common/log';
import {parseURL} from 'common/utils/url';

export const generateHandleConsoleMessage = (log: Logger) => (event: Event<WebContentsConsoleMessageEventParams>) => {
    const wcLog = log.withPrefix('renderer');
    let logFn = wcLog.debug;
    switch (event.level) {
    case 'error':
        logFn = wcLog.error;
        break;
    case 'warning':
        logFn = wcLog.warn;
        break;
    }

    // Only include line entries if we're debugging
    const entries = [sanitizeMessage(event.sourceId, event.message)];
    if (['debug', 'silly'].includes(getLevel())) {
        entries.push(sanitizeMessage(event.sourceId, `(${path.basename(event.sourceId)}:${event.lineNumber})`));
    }

    logFn(...entries);
};

function sanitizeMessage(sourceURL: string, message: string) {
    const parsedURL = parseURL(sourceURL);
    if (!parsedURL) {
        return message;
    }
    return message.replace(parsedURL.host, '<host>');
}

export function isCustomProtocol(url: URL) {
    return url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== `${MATTERMOST_PROTOCOL}:`;
}

export function isMattermostProtocol(url: URL) {
    return url.protocol === `${MATTERMOST_PROTOCOL}:`;
}
