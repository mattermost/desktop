// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcMain, webContents} from 'electron';

import {View} from './view';

const TOOLBAR_HEIGHT = 32;

export default class ViewManager {
  constructor(window, config) {
    this.window = window;
    this.config = config;
    this.views = new Map();
    this.selectedId = 0;
    this._fullscreen = false;

    ipcMain.on('add-tab', (e, teamMeta, isActive) => {
      this.create(teamMeta, isActive);
    });

    ipcMain.on('view-select', (e, id = this.selectedId) => {
      this.select(id);
    });

    ipcMain.on('view-destroy', (e, id) => {
      this.destroy(id);
    });

    ipcMain.on('browserview-clear', () => {
      this.clear();
    });
  }

  get fullscreen() {
    return this._fullscreen;
  }

  set fullscreen(val) {
    this._fullscreen = val;
    this.fixBounds();
  }

  get selected() {
    return this.views.get(this.selectedId);
  }

  create(teamMeta, isActive) {
    const view = new View(this.window, teamMeta.url);
    const {id} = view.webContents;
    this.window.webContents.send('return-view-id', id);

    view.webContents.once('destroyed', () => {
      this.views.delete(id);
    });

    this.views.set(view.webContents.id, view);

    if (isActive) {
      this.select(id);
    }

    return view;
  }

  clear() {
    this.window.setBrowserView(null);
    Object.values(this.views).forEach((x) => x.destroy());
  }

  select(id) {
    console.log('select view valled id: ', id);
    const {selected} = this;
    const view = this.views.get(id);

    if (!view) {
      return;
    }

    this.selectedId = id;

    this.window.removeBrowserView(selected);
    this.window.addBrowserView(view);

    view.webContents.focus();

    this.fixBounds();
  }

  fixBounds() {
    const view = this.selected;

    if (!view) {
      return;
    }

    const {width, height} = this.window.getContentBounds();

    const newBounds = {
      x: 0,
      y: this.fullscreen ? 0 : TOOLBAR_HEIGHT + 1,
      width,
      height: this.fullscreen ? height : height - TOOLBAR_HEIGHT,
    };

    if (newBounds !== view.bounds) {
      view.setBounds(newBounds);
      view.bounds = newBounds;
    }
  }

  destroy(id) {
    const view = this.views.get(id);

    if (view && !view.isDestroyed()) {
      this.window.removeBrowserView(view);
      view.destroy();
    }
  }
}