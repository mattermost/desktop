// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import electron, {app} from 'electron';
import {format} from 'url';
import path from 'path';
import log from 'electron-log';
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

export function getLocalURL(urlPath, query) {
  const options = {
    path: urlPath,
    query,
    slashes: true,
  };
  if (process.env.WEBPACK_DEV_SERVER) {
    log.info('detected webserver');
    options.protocol = 'http';
    options.hostname = 'localhost';
    options.port = '9000';
    options.pathname = `/renderer/${urlPath}`;
  } else {
    options.protocol = 'file';
    if (process.env.NODE_ENV === 'production') {
      options.pathname = path.join(electron.app.getAppPath(), `dist/renderer/${urlPath}`);
    } else {
      options.pathname = path.resolve(__dirname, `../../dist/renderer/${urlPath}`); // TODO: find a better way to work with webpack on this
    }
  }
  return format(options);
}