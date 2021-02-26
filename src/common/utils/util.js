// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import electron, {BrowserWindow} from 'electron';

import {DEVELOPMENT, PRODUCTION} from './constants';

function getDisplayBoundaries() {
    const {screen} = electron;

    const displays = screen.getAllDisplays();

    return displays.map((display) => {
        return {
            maxX: display.workArea.x + display.workArea.width,
            maxY: display.workArea.y + display.workArea.height,
            minX: display.workArea.x,
            minY: display.workArea.y,
            maxWidth: display.workArea.width,
            maxHeight: display.workArea.height,
        };
    });
}

function runMode() {
    return process.env.NODE_ENV === PRODUCTION ? PRODUCTION : DEVELOPMENT;
}

// workaround until electron 12 hits, since fromWebContents return a null value if using a webcontent from browserview
function browserWindowFromWebContents(content) {
    let window;
    if (content.type === 'browserview') {
        for (const win of BrowserWindow.getAllWindows()) {
            for (const view of win.getBrowserViews()) {
                if (view.webContents.id === content.id) {
                    window = win;
                }
            }
        }
    } else {
        window = BrowserWindow.fromWebContents(content);
    }
    return window;
}

export default {
    getDisplayBoundaries,
    runMode,
    browserWindowFromWebContents,
};
