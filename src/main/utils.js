// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import electron, {app} from 'electron';
import {format} from 'url';
import path from 'path';
import log from 'electron-log';

import {DEV_SERVER, PRODUCTION} from 'common/utils/constants';
import Utils from 'common/utils/util';

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
  const mode = Utils.runMode();
  if (mode === DEV_SERVER) {
    log.info('detected webserver');
    options.protocol = 'http';
    options.hostname = 'localhost';
    options.port = '9000';
    options.pathname = `/renderer/${urlPath}`;
  } else {
    options.protocol = 'file';
    if (mode === PRODUCTION) {
      options.pathname = path.join(electron.app.getAppPath(), `dist/renderer/${urlPath}`);
    } else {
      options.pathname = path.resolve(__dirname, `../../dist/renderer/${urlPath}`); // TODO: find a better way to work with webpack on this
    }
  }
  return format(options);
}