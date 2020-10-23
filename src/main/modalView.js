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
    this.view = new BrowserView(); // TODO: options
    this.onReject = onReject;
    this.onResolve = onResolve;
    this.window = currentWindow;
    this.windowAttached = null;
    this.status = ACTIVE;
  }

  show = (win) => {
    if (!this.windowAttached) {
      this.windowAttached = win || this.window;
      this.windowAttached.addBrowserView(this.view);
      this.status = SHOWING;
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