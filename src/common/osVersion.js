// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import os from 'os';
const releaseSplit = os.release().split('.');
const CATALINA_MAJOR = 19;

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
  isCatalina() {
    if (process.platform !== 'darwin') {
      return false;
    }

    // mapping release-version: https://en.wikipedia.org/wiki/Darwin_%28operating_system%29#Release_history
    return this.major >= CATALINA_MAJOR;
  }
};
