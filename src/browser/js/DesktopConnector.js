// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import EventEmitter from 'events';

/**
 * Class to handle interfacing with the loaded webapp
 */
export default class DesktopConnector extends EventEmitter {
  /**
   * Sends data to the webapp for the provided event
   * @param {string} event
   * @param  {...any} data
   */
  send(event, ...data) {
    if (window.desktopBridge && window.desktopBridge.ready) {
      window.desktopBridge.webapp.receive(event, ...data);
    }
  }

  /**
   * Receives data from the desktop app for the provided event
   * @param {string} event
   * @param  {...any} data
   * @emits {event} the provided event and data is emitted to listeners
   */
  receive(event, ...data) {
    const serializedData = JSON.stringify([event, ...data]);
    this.emit(...JSON.parse(serializedData));
  }
}