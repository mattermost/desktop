// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcMain, powerMonitor} from 'electron';

const ACTIVITY_CHECK_INTERVAL = 1000;
const IDLE_THRESHOLD = 30;

export default class SystemActivityMonitor {
  constructor() {
    this.sendActiveInterval = '';
    this.stateCheckIinterval = '';
    this.isIdle = false;

    powerMonitor.on('suspend', () => {
      this.
        stop().
        updateIdleState(true);
    });

    powerMonitor.on('lock-screen', () => {
      this.
        stop().
        updateIdleState(true);
    });

    powerMonitor.on('resume', () => {
      this.
        start().
        updateIdleState(false);
    });

    powerMonitor.on('unlock-screen', () => {
      this.
        start().
        updateIdleState(false);
    });

    ipcMain.on('check-idle', (event) => {
      event.returnValue = this.isIdle;
    });
  }

  start() {
    clearInterval(this.stateCheckIinterval);

    this.stateCheckIinterval = setInterval(() => {
      powerMonitor.querySystemIdleTime((idleTime) => {
        this.updateIdleState(idleTime > IDLE_THRESHOLD);
      });
    }, ACTIVITY_CHECK_INTERVAL);
    return this;
  }

  stop() {
    clearInterval(this.stateCheckIinterval);
    return this;
  }

  updateIdleState(isIdle) {
    this.isIdle = isIdle;
    return this;
  }
}
