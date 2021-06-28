// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import electron from 'electron';

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

const DEFAULT_MAX = 20;

function shorten(string: string, max?: number) {
    const maxLength = (max && max >= 4) ? max : DEFAULT_MAX;
    if (string.length >= maxLength) {
        return `${string.slice(0, maxLength - 3)}...`;
    }
    return string;
}

export default {
    getDisplayBoundaries,
    runMode,
    shorten,
};
