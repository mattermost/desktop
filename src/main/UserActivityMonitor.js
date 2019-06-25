// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
    this.forceInactive = false;
    this.idleTime = 0;
    this.lastStatusUpdate = 0;
    this.systemIdleTimeIntervalID = -1;

    this.config = {
      internalUpdateFrequencyMs: 1 * 1000, // eslint-disable-line no-magic-numbers
      statusUpdateThresholdMs: 60 * 1000, // eslint-disable-line no-magic-numbers
      activityTimeoutSec: 5 * 60, // eslint-disable-line no-magic-numbers
    };

    // NOTE: binding needed to prevent error; fat arrow class methods don't work in current setup
    // Error: "Error: async hook stack has become corrupted (actual: #, expected: #)"
    this.handleSystemGoingAway = this.handleSystemGoingAway.bind(this);
    this.handleSystemComingBack = this.handleSystemComingBack.bind(this);
  }

  get userIsActive() {
    return this.forceInactive ? false : this.isActive;
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
   * @param {nunber} config.activityTimeoutSec
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
    electron.powerMonitor.on('suspend', this.handleSystemGoingAway);
    electron.powerMonitor.on('resume', this.handleSystemComingBack);
    electron.powerMonitor.on('shutdown', this.handleSystemGoingAway);
    electron.powerMonitor.on('lock-screen', this.handleSystemGoingAway);
    electron.powerMonitor.on('unlock-screen', this.handleSystemComingBack);

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
    electron.powerMonitor.off('suspend', this.handleSystemGoingAway);
    electron.powerMonitor.off('resume', this.handleSystemComingBack);
    electron.powerMonitor.off('shutdown', this.handleSystemGoingAway);
    electron.powerMonitor.off('lock-screen', this.handleSystemGoingAway);
    electron.powerMonitor.off('unlock-screen', this.handleSystemComingBack);

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

    if (this.idleTime > this.config.activityTimeoutSec) {
      this.updateUserActivityStatus(false);
    } else if (!this.forceInactive && this.idleTime < this.config.activityTimeoutSec) {
      this.updateUserActivityStatus(true);
    }
  }

  /**
   * Updates user activity status if changed and triggers a status update
   *
   * @param {boolean} isActive
   * @param {boolean} isSystemEvent – indicates whether the update was triggered by a system event (log in/out, screesaver on/off etc)
   * @private
   */
  updateUserActivityStatus(isActive = false, isSystemEvent = false) {
    const now = Date.now();
    if (isActive !== this.isActive) {
      this.isActive = isActive;
      this.sendStatusUpdate(now, isSystemEvent);
    } else if (now - this.lastStatusUpdate > this.config.statusUpdateThresholdMs) {
      this.sendStatusUpdate(now, isSystemEvent);
    }
  }

  /**
   * Sends an update with user activity status and current system idle time
   *
   * @emits {status} emitted at regular, definable intervals providing an update on user active status and idle time
   * @private
   */
  sendStatusUpdate(now = Date.now(), isSystemEvent = false) {
    this.lastStatusUpdate = now;
    this.emit('status', {
      userIsActive: this.isActive,
      idleTime: this.idleTime,
      isSystemEvent,
    });
  }

  /**
   * System event handlers
   *
   * @private
   */
  handleSystemGoingAway() {
    this.forceInactive = true;
    this.updateUserActivityStatus(false, true);
  }
  handleSystemComingBack() {
    this.forceInactive = false;
    this.updateUserActivityStatus(true, true);
  }
}
