// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import EventEmitter from 'events';

import electron from 'electron';

const {app} = electron;

/**
 * Monitors system idle time, listens for system events and fires status updates as needed
 */
export default class UserActivityMonitor extends EventEmitter {
  constructor() {
    super();

    this.isActive = true;
    this.forceUserIsInactive = false;
    this.idleTime = 0;
    this.lastStatusUpdate = 0;
    this.systemIdleTimeIntervalID = -1;

    this.config = {
      internalUpdateFrequencyMs: 1 * 1000,
      statusUpdateThresholdMs: 60 * 1000,
      userActivityTimeoutSec: 5 * 60,
    };

    // NOTE: binding needed to prevent error, fat arrow methods don't work in current setup
    // Error: "Error: async hook stack has become corrupted (actual: #, expected: #)"
    this.handleSuspend = this.handleSuspend.bind(this);
    this.handleResume = this.handleResume.bind(this);
    this.handleShutdown = this.handleShutdown.bind(this);
    this.handleLockScreen = this.handleLockScreen.bind(this);
    this.handleUnlockScreen = this.handleUnlockScreen.bind(this);
  }

  get userIsActive() {
    return this.forceUserIsInactive ? false : this.isActive;
  }

  get userIdleTime() {
    return this.idleTime;
  }

  /**
   * Begin monitoring system events and idle time at defined frequency
   *
   * @param {Object} config - overide internal configuration defaults
   * @param {nunber} config.internalUpdateFrequencyMs
   * @param {nunber} config.statusUpdateThresholdMs
   * @param {nunber} config.userActivityTimeoutSec
   * @emits {error} emitted when method is called before the app is ready
   * @emits {error} emitted when this method has previously been called but not subsequently stopped
   */
  startMonitoring(config = {}) {
    if (!app.isReady()) {
      this.emit('error', new Error('UserActivityMonitor.startMonitoring can only be called after app is ready'));
      return;
    }

    if (this.systemIdleTimeIntervalID >= 0) {
      this.emit('error', new Error('User activity monitoring is already in progress'));
      return;
    }

    this.config = Object.assign({}, this.config, config);

    // NOTE: electron.powerMonitor cannot be referenced until the app is ready
    electron.powerMonitor.on('suspend', this.handleSuspend);
    electron.powerMonitor.on('resume', this.handleResume);
    electron.powerMonitor.on('shutdown', this.handleShutdown);
    electron.powerMonitor.on('lock-screen', this.handleLockScreen);
    electron.powerMonitor.on('unlock-screen', this.handleUnlockScreen);

    this.systemIdleTimeIntervalID = setInterval(() => {
      try {
        electron.powerMonitor.querySystemIdleTime((idleTime) => {
          this.updateIdleTime(idleTime);
        });
      } catch (err) {
        console.log('Error getting system idle time:', err);
      }
    }, this.config.internalUpdateFrequencyMs);
  }

  /**
   * Stop monitoring system events and idle time
   */
  stopMonitoring() {
    electron.powerMonitor.off('suspend', this.handleSuspend);
    electron.powerMonitor.off('resume', this.handleResume);
    electron.powerMonitor.off('shutdown', this.handleShutdown);
    electron.powerMonitor.off('lock-screen', this.handleLockScreen);
    electron.powerMonitor.off('unlock-screen', this.handleUnlockScreen);

    clearInterval(this.systemIdleTimeIntervalID);
  }

  /**
   * Updates internal idle time properties and conditionally triggers updates to user activity status
   *
   * @param {integer} idleTime
   * @private
   */
  updateIdleTime(idleTime) {
    this.idleTime = idleTime;

    if (this.idleTime > this.config.userActivityTimeoutSec) {
      this.updateUserActivityStatus(false);
    } else if (!this.forceUserIsInactive && this.idleTime < this.config.userActivityTimeoutSec) {
      this.updateUserActivityStatus(true);
    }
  }

  /**
   * Updates user activity status if changed and triggers a status update
   *
   * @param {boolean} isActive
   * @private
   */
  updateUserActivityStatus(isActive = false) {
    if (isActive !== this.isActive) {
      this.isActive = isActive;
      this.sendStatusUpdate();
    } else if (new Date().getTime() - this.lastStatusUpdate > this.config.statusUpdateThresholdMs) {
      this.sendStatusUpdate();
    }
  }

  /**
   * Sends an update with user activity status and current system idle time
   *
   * @emits {status} emitted at regular, definable intervals providing an update on user active status and idle time
   * @private
   */
  sendStatusUpdate() {
    this.lastStatusUpdate = new Date().getTime();
    this.emit('status', {
      userIsActive: this.isActive,
      idleTime: this.idleTime,
    });
  }

  /**
   * System event handlers
   *
   * @private
   */
  handleSuspend() {
    this.forceUserIsInactive = true;
    this.updateUserActivityStatus(false);
  }
  handleResume() {
    this.forceUserIsInactive = false;
    this.updateUserActivityStatus(true);
  }
  handleShutdown() {
    this.forceUserIsInactive = true;
    this.updateUserActivityStatus(false);
  }
  handleLockScreen() {
    this.forceUserIsInactive = true;
    this.updateUserActivityStatus(false);
  }
  handleUnlockScreen() {
    this.forceUserIsInactive = false;
    this.updateUserActivityStatus(true);
  }
}
