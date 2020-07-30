// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app} from 'electron';

const TAB_BAR_HEIGHT = 38;

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

export function getWindowBoundaries(win) {
  const {width, height} = win.getContentBounds();
  return {
    x: 0,
    y: TAB_BAR_HEIGHT,
    width,
    height: height - TAB_BAR_HEIGHT,
  };
}