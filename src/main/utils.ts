// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import electron, {app, BrowserWindow} from 'electron';
import path from 'path';

import {Args} from 'types/args';

import {BACK_BAR_HEIGHT, PRODUCTION, TAB_BAR_HEIGHT} from 'common/utils/constants';
import Utils from 'common/utils/util';

export function shouldBeHiddenOnStartup(parsedArgv: Args) {
    if (parsedArgv.hidden) {
        return true;
    }
    if (process.platform === 'darwin') {
        if (app.getLoginItemSettings().wasOpenedAsHidden) {
            return true;
        }
    }
    return false;
}

export function getWindowBoundaries(win: BrowserWindow, hasBackBar = false) {
    const {width, height} = win.getContentBounds();
    return getAdjustedWindowBoundaries(width, height, hasBackBar);
}

export function getAdjustedWindowBoundaries(width: number, height: number, hasBackBar = false) {
    return {
        x: 0,
        y: TAB_BAR_HEIGHT + (hasBackBar ? BACK_BAR_HEIGHT : 0),
        width,
        height: height - TAB_BAR_HEIGHT - (hasBackBar ? BACK_BAR_HEIGHT : 0),
    };
}

export function getLocalURLString(urlPath: string, query?: Map<string, string>, isMain?: boolean) {
    const localURL = getLocalURL(urlPath, query, isMain);
    return localURL.href;
}

export function getLocalURL(urlPath: string, query?: Map<string, string>, isMain?: boolean) {
    let pathname;
    const processPath = isMain ? '' : '/renderer';
    const mode = Utils.runMode();
    const protocol = 'file';
    const hostname = '';
    const port = '';
    if (mode === PRODUCTION) {
        pathname = path.join(electron.app.getAppPath(), `${processPath}/${urlPath}`);
    } else {
        pathname = path.resolve(__dirname, `../../dist/${processPath}/${urlPath}`); // TODO: find a better way to work with webpack on this
    }
    const localUrl = new URL(`${protocol}://${hostname}${port}`);
    localUrl.pathname = pathname;
    if (query) {
        query.forEach((value: string, key: string) => {
            localUrl.searchParams.append(encodeURIComponent(key), encodeURIComponent(value));
        });
    }

    return localUrl;
}

export function getLocalPreload(file: string) {
    if (Utils.runMode() === PRODUCTION) {
        return path.join(electron.app.getAppPath(), `${file}`);
    }
    return path.resolve(__dirname, `../../dist/${file}`);
}

export function composeUserAgent() {
    const baseUserAgent = app.userAgentFallback.split(' ');

    // filter out the Mattermost tag that gets added earlier on
    const filteredUserAgent = baseUserAgent.filter((ua) => !ua.startsWith('Mattermost'));

    return `${filteredUserAgent.join(' ')} Mattermost/${app.getVersion()}`;
}
