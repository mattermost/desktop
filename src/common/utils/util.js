// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import electron from 'electron';

import {DEVELOPMENT, DEV_SERVER, PRODUCTION} from './constants';

function getDisplayBoundaries() {
  const {screen} = electron;

  const displays = screen.getAllDisplays();

  return displays.map((display) => {
    return {
      maxX: display.workArea.x + display.workArea.width,
      maxY: display.workArea.y + display.workArea.height,
      minX: display.workArea.x,
      minY: display.workArea.y,
      maxWidth: display.workArea.width,
      maxHeight: display.workArea.height,
    };
  });
}

function runMode() {
  let mode = DEVELOPMENT;
  if (process.env.WEBPACK_DEV_SERVER) {
    mode = DEV_SERVER;
  } else if (process.env.NODE_ENV === PRODUCTION) {
    mode = PRODUCTION;
  }
  return mode;
}

export default {
  getDisplayBoundaries,
  runMode,
};
