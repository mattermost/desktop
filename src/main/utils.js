// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import electron, {app} from 'electron';
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

export function getLocalURLString(urlPath, query, isMain) {
  const localURL = getLocalURL(urlPath, query, isMain);
  return localURL.href;
}

export function getLocalURL(urlPath, query, isMain) {
  let protocol;
  let hostname;
  let port;
  let pathname;
  const processPath = isMain ? '' : '/renderer';
  const mode = Utils.runMode();
  if (mode === DEV_SERVER) {
    log.info('detected webserver');
    protocol = 'http';
    hostname = 'localhost';
    port = ':9000'; // TODO: find out how to get the devserver port
    pathname = `${processPath}/${urlPath}`;
  } else {
    protocol = 'file';
    hostname = '';
    port = '';
    if (mode === PRODUCTION) {
      pathname = path.join(electron.app.getAppPath(), `dist/${processPath}/${urlPath}`);
    } else {
      pathname = path.resolve(__dirname, `../../dist/${processPath}/${urlPath}`); // TODO: find a better way to work with webpack on this
    }
  }
  const localUrl = new URL(`${protocol}://${hostname}${port}`);
  localUrl.pathname = pathname;
  if (query) {
    query.forEach((value, key) => {
      localUrl.searchParams.append(encodeURIComponent(key), encodeURIComponent(value));
    });
  }

  return localUrl;
}