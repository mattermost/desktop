// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import EventEmitter from 'events';

/**
 * Provides the bridging infrastructure to connect the desktop and webapp together
 */
export default class DesktopBridge extends EventEmitter {
  constructor() {
    super();

    window.desktopBridge = this;
  }
}