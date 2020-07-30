// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {BrowserView} from 'electron';
import log from 'electron-log';

import {getWindowBoundaries} from './utils';

export class MattermostView {
  constructor(server, win, options) {
    this.server = server;
    this.window = win;
    this.options = {
      webPreferences: {
        preload: path.resolve(__dirname, 'preload.js'),
      },
      ...options
    };
    this.isVisible = false;
    this.view = new BrowserView(this.options);
    log.info(`BrowserView created for server ${this.server.name}`);
  }

  show = (requestedVisibility) => {
    const request = typeof requestedVisibility === 'undefined' ? true : requestedVisibility;
    if (request && !this.isVisible) {
      this.win.addBrowserView(this.view);
      this.setBounds(getWindowBoundaries(this.win));
    } else if (!request && this.isVisible) {
      this.win.removeBrowserView(this.view);
    }
    this.isVisible = request;
  }

  setBounds = (boundaries) => {
    // todo: review this, as it might not work properly with devtools/minimizing/resizing
    this.view.setBounds(boundaries);
    this.view.setAutoResize({
      height: true,
      width: true,
      horizontal: true,
      vertical: true,
    });
  }
}