// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import os from 'os';
const releaseSplit = os.release().split('.');

export default {
    major: parseInt(releaseSplit[0], 10),
    minor: parseInt(releaseSplit[1], 10),
    isLowerThanOrEqualWindows8_1() {
        if (process.platform !== 'win32') {
            return false;
        }

        // consider Windows 7 and later.
        return (this.major <= 6 && this.minor <= 3);
    },
};
