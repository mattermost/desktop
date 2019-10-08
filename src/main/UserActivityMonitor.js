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
    this.idleTime = 0;
    this.lastSetActive = null;
    this.systemIdleTimeIntervalID = -1;

    this.config = {
      updateFrequencyMs: 1 * 1000, // eslint-disable-line no-magic-numbers
      inactiveThresholdSec: 60, // eslint-disable-line no-magic-numbers
      statusUpdateThresholdMs: 60 * 1000, // eslint-disable-line no-magic-numbers
    };
  }

  get userIsActive() {
    return this.isActive;
  }

  get userIdleTime() {
    return this.idleTime;
  }

  /**
   * Begin monitoring system events and idle time at defined frequency
   *
   * @param {Object} config - overide internal configuration defaults
   * @param {number} config.updateFrequencyMs
   * @param {number} config.inactiveThresholdSec
   * @param {number} config.statusUpdateThresholdMs
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

    this.systemIdleTimeIntervalID = setInterval(() => {
      try {
        electron.powerMonitor.querySystemIdleTime((idleTime) => {
          this.updateIdleTime(idleTime);
        });
      } catch (err) {
        console.log('Error getting system idle time:', err);
      }
    }, this.config.updateFrequencyMs);
  }

  /**
   * Stop monitoring system events and idle time
   */
  stopMonitoring() {
    clearInterval(this.systemIdleTimeIntervalID);
  }

  /**
   * Updates internal idle time and sets internal user activity state
   *
   * @param {integer} idleTime
   * @private
   */
  updateIdleTime(idleTime) {
    this.idleTime = idleTime;
    if (idleTime > this.config.inactiveThresholdSec) {
      this.setActivityState(false);
    } else {
      this.setActivityState(true);
    }
  }

  /**
   * Updates user active state and conditionally triggers a status update
   *
   * @param {boolean} isActive
   * @param {boolean} isSystemEvent – indicates whether the update was triggered by a system event (log in/out, screesaver on/off etc)
   * @private
   */
  setActivityState(isActive = false, isSystemEvent = false) {
    this.isActive = isActive;

    if (isSystemEvent) {
      this.sendStatusUpdate(true);
    }

    const now = Date.now();

    if (isActive && (this.lastSetActive == null || now - this.lastSetActive >= this.config.statusUpdateThresholdMs)) {
      this.sendStatusUpdate(false);
      this.lastSetActive = now;
    } else if (!isActive) {
      this.lastSetActive = null;
    }
  }

  /**
   * Sends an update with user activity status and current system idle time
   *
   * @emits {status} emitted at regular, definable intervals providing an update on user active status and idle time
   * @private
   */
  sendStatusUpdate(isSystemEvent = false) {
    this.emit('status', {
      userIsActive: this.isActive,
      idleTime: this.idleTime,
      isSystemEvent,
    });
  }
}
