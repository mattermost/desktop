// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

/** Pre-release suffixes are ignored so `12.0.0-rc1` counts as 12.0.0 for CMT feature gates. */
function numericVersion(version) {
    const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
        return null;
    }
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isVersionAtLeast(version, minimum) {
    const current = numericVersion(version ?? '');
    const need = numericVersion(minimum);
    if (!current || !need) {
        return false;
    }
    for (let i = 0; i < 3; i++) {
        if (current[i] > need[i]) {
            return true;
        }
        if (current[i] < need[i]) {
            return false;
        }
    }
    return true;
}

module.exports = {isVersionAtLeast};
