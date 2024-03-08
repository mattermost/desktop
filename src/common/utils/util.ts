// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import type {Rectangle} from 'electron';

import {DEVELOPMENT, PRODUCTION} from './constants';

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

function isVersionGreaterThanOrEqualTo(currentVersion: string, compareVersion: string): boolean {
    if (currentVersion === compareVersion) {
        return true;
    }

    // We only care about the numbers
    const currentVersionNumber = (currentVersion || '').split('.').filter((x) => (/^[0-9]+$/).exec(x) !== null);
    const compareVersionNumber = (compareVersion || '').split('.').filter((x) => (/^[0-9]+$/).exec(x) !== null);

    for (let i = 0; i < Math.max(currentVersionNumber.length, compareVersionNumber.length); i++) {
        const currentVersion = parseInt(currentVersionNumber[i], 10) || 0;
        const compareVersion = parseInt(compareVersionNumber[i], 10) || 0;
        if (currentVersion > compareVersion) {
            return true;
        }

        if (currentVersion < compareVersion) {
            return false;
        }
    }

    // If all components are equal, then return true
    return true;
}

export function t(s: string) {
    return s;
}

function boundsDiff(base: Rectangle, actual: Rectangle) {
    return {
        x: base.x - actual.x,
        y: base.y - actual.y,
        width: base.width - actual.width,
        height: base.height - actual.height,
    };
}

// MM-48463 - https://stackoverflow.com/a/3561711/5605822
export const escapeRegex = (s?: string) => {
    if (typeof s !== 'string') {
        return '';
    }
    return s.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
};

export function copy<T>(data: T) {
    return Object.assign({}, data);
}

export default {
    runMode,
    shorten,
    isVersionGreaterThanOrEqualTo,
    boundsDiff,
    escapeRegex,
};
