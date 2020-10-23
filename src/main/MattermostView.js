// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {BrowserView, app} from 'electron';
import log from 'electron-log';

import {getWindowBoundaries} from './utils';

export class MattermostView {
  constructor(server, win, options) {
    this.server = server;
    this.window = win;
    this.options = {
      webPreferences: {
        preload: path.resolve(__dirname, 'preload_bundle.js'),
      },
      ...options
    };
    this.isVisible = false;
    this.view = new BrowserView(this.options);
    log.info(`BrowserView created for server ${this.server.name}`);
  }

  load = (someURL) => {
    const loadURL = (typeof someURL === 'undefined') ? `${this.server.url.toString()}` : parseUrl(someURL);
    log.info(`[${this.server.name}] Loading ${loadURL}`);

    // copying what webview sends
    // TODO: review
    const userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.146 Electron/6.1.7 Safari/537.36 Mattermost/${app.getVersion()}`;

    const loading = this.view.webContents.loadURL(loadURL, {userAgent});
    loading.then((result) => {
      log.info(`[${this.server.name}] finished loading ${loadURL}: ${result}`);
    }).catch((err) => {
      log.info(`[${this.server.name}] failed loading ${loadURL}: ${err}`);
    });
  }

  show = (requestedVisibility) => {
    const request = typeof requestedVisibility === 'undefined' ? true : requestedVisibility;
    if (request && !this.isVisible) {
      this.window.addBrowserView(this.view);
      this.setBounds(getWindowBoundaries(this.window));
    } else if (!request && this.isVisible) {
      this.window.removeBrowserView(this.view);
    }
    this.isVisible = request;
  }

  hide = () => this.show(false);

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