// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app} from 'electron';

export function shouldBeHiddenOnStartup(parsedArgv) {
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
