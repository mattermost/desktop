// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

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

export default {
    runMode,
    shorten,
    isVersionGreaterThanOrEqualTo,
};
