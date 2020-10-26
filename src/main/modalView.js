// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserView} from 'electron';

// TODO: should we use windowmanager to get the currentwindow?

const ACTIVE = 'active';
const SHOWING = 'showing';
const DONE = 'done';
const RATIO = 5;

export class ModalView {
  constructor(html, preload, data, onResolve, onReject, currentWindow) {
    this.html = html;
    this.data = data;
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
      const {width, height} = this.window.getBounds();
      const x = Math.floor(width / RATIO);
      const y = Math.floor(height / RATIO);
      const bounds = {
        x,
        y,
        height: height - y,
        width: width - x,
      };
      console.log(`modal boundaries: ${bounds}`);
      console.log(bounds);
      this.view.setBounds(bounds);
      this.status = SHOWING;
      this.view.webContents.openDevTools();
      const bvs = this.windowAttached.getBrowserViews();
      console.log(`bvs attached: ${bvs.length}`);
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