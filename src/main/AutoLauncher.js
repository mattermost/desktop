// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import AutoLaunch from 'auto-launch';
import {app} from 'electron';
import isDev from 'electron-is-dev';

export default class AutoLauncher {
  constructor() {
    this.appLauncher = new AutoLaunch({
      name: app.name,
      isHidden: true,
    });
  }

  isEnabled() {
    return this.appLauncher.isEnabled();
  }

  async blankPromise() {
    return null;
  }

  async enable() {
    if (isDev) {
      console.log('In development mode, autostart config never effects');
      return this.blankPromise();
    }
    const enabled = await this.isEnabled();
    if (!enabled) {
      return this.appLauncher.enable();
    }
    return this.blankPromise();
  }

  async disable() {
    if (isDev) {
      console.log('In development mode, autostart config never effects');
      return this.blankPromise();
    }
    const enabled = await this.isEnabled();
    if (enabled) {
      return this.appLauncher.disable();
    }
    return this.blankPromise();
  }
}
