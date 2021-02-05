// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserView} from 'electron';

import {getWindowBoundaries} from './utils';

// TODO: should we use windowmanager to get the currentwindow?

const ACTIVE = 'active';
const SHOWING = 'showing';
const DONE = 'done';

export class ModalView {
  constructor(key, html, preload, data, onResolve, onReject, currentWindow) {
    this.key = key;
    this.html = html;
    this.data = data;
    console.log(`preloading with ${preload}`);
    this.view = new BrowserView({webPreferences: {
      preload,
    }});
    this.onReject = onReject;
    this.onResolve = onResolve;
    this.window = currentWindow;
    this.windowAttached = null;
    this.status = ACTIVE;
    try {
      this.view.webContents.loadURL(this.html);
    } catch (e) {
      console.log('there was an error loading the modal:');
      console.log(e);
    }
  }

  show = (win, withDevTools) => {
    if (this.windowAttached) {
      // we'll reatach
      this.windowAttached.removeBrowserView(this.view);
    }
    this.windowAttached = win || this.window;

    this.windowAttached.addBrowserView(this.view);
    this.view.setBounds(getWindowBoundaries(this.windowAttached));
    this.view.setAutoResize({
      height: true,
      width: true,
      horizontal: true,
      vertical: true,
    });
    this.status = SHOWING;
    if (this.view.webContents.isLoading()) {
      this.view.webContents.once('did-finish-load', () => {
        this.view.webContents.focus();
      });
    } else {
      this.view.webContents.focus();
    }

    if (withDevTools) {
      console.log(`showing dev tools for ${this.key}`);
      this.view.webContents.openDevTools({mode: 'detach'});
    }
  }

  hide = () => {
    if (this.windowAttached) {
      if (this.view.webContents.isDevToolsOpened()) {
        this.view.webContents.closeDevTools();
      }

      this.windowAttached.removeBrowserView(this.view);
      this.windowAttached = null;
      this.status = ACTIVE;
    }
  }

  handleInfoRequest = () => {
    return this.data;
  }

  reject = (data) => {
    if (this.onReject) {
      this.onReject(data);
    }
    this.hide();
    this.status = DONE;
  }

  resolve = (data) => {
    if (this.onResolve) {
      this.onResolve(data);
    }
    this.hide();
    this.status = DONE;
  }

  isActive = () => this.status !== DONE;
}
