// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import EventEmitter from 'events';

import DesktopConnector from './DesktopConnector';

// placeholder bridge object
window.desktopBridge = {
  ready: false,
};

/**
 * Provides the bridging infrastructure to connect the desktop and webapp together
 */
export default class DesktopBridge extends EventEmitter {
  constructor() {
    super();

    this.ready = false;

    this.desktop = null;
    this.webapp = null;

    window.desktopBridge = this;

    this.registerDesktopConnector = this.registerDesktopConnector.bind(this);
    this.registerWebappConnector = this.registerWebappConnector.bind(this);
  }

  /**
   * Connect the desktop app to the desktop bridge
   */
  initialize() {
    this.registerDesktopConnector(new DesktopConnector());
  }

  /**
   * Connects the provided connector to the desktop bridge as the desktop connector
   * @param {EventEmitter} connector
   */
  registerDesktopConnector(connector) {
    if (connector && connector.emit) {
      this.desktop = connector;
      if (this.webapp) {
        this.ready = true;
        this.emit('ready');
      }
    }
  }

  /**
   * Connects the provided connector to the desktop bridge as the webapp connector
   * @param {EventEmitter} connector
   */
  registerWebappConnector(connector) {
    if (connector && connector.emit) {
      this.webapp = connector;
      if (this.desktop) {
        this.ready = true;
        this.emit('ready');
      }
    }
  }
}