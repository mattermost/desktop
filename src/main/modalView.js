// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserView} from 'electron';

// TODO: should we use windowmanager to get the currentwindow?

const ACTIVE = 'active';
const SHOWING = 'showing';
const DONE = 'done';

export class ModalView {
  constructor(html, preload, data, onResolve, onReject, currentWindow) {
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

  show = (win) => {
    if (!this.windowAttached) {
      this.windowAttached = win || this.window;
      this.windowAttached.addBrowserView(this.view);
      this.view.setBounds(this.windowAttached.getContentBounds());
      this.view.setAutoResize({
        height: true,
        width: true,
        horizontal: true,
        vertical: true,
      });
      this.status = SHOWING;

      // uncomment if something goes wrong with modals
      //this.view.webContents.openDevTools();
    }
  }

  hide = () => {
    if (this.windowAttached) {
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