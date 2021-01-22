// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import log from 'electron-log';
import {BrowserView} from 'electron';

import {SECOND} from 'common/utils/constants';
import urlUtils from 'common/utils/url';
import {UPDATE_TARGET_URL, SET_SERVER_KEY} from 'common/communication';

import contextMenu from './contextMenu';
import {MattermostServer} from './MattermostServer';
import {MattermostView} from './MattermostView';
import {getLocalURLString} from './utils';
import {showModal} from './modalManager';

const URL_VIEW_DURATION = 10 * SECOND;
const URL_VIEW_HEIGHT = 36;

export class ViewManager {
  constructor(config, updateBadge) {
    this.configServers = config.teams;
    this.viewOptions = {spellcheck: config.useSpellChecker};
    this.views = new Map(); // keep in mind that this doesn't need to hold server order, only tabs on the renderer need that.
    this.currentView = null;
    this.urlView = null;
    this.updateBadge = updateBadge;
  }

  loadServer = (server, mainWindow) => {
    const srv = new MattermostServer(server.name, server.url);
    const view = new MattermostView(srv, mainWindow, this.viewOptions, this.updateBadge);
    this.views.set(server.name, view);
    view.setReadyCallback(this.activateView);
    view.load();
    view.on(UPDATE_TARGET_URL, this.showURLView);
  }

  // TODO: we shouldn't pass the main window, but get it from windowmanager
  // TODO: we'll need an event in case the main window changes so this updates accordingly
  load = (mainWindow) => {
    this.configServers.forEach((server) => this.loadServer(server, mainWindow));
  }

  reloadConfiguration = (configServers, mainWindow) => {
    this.configServers = configServers.concat();
    const oldviews = this.views;
    this.views = new Map();
    const sorted = this.configServers.sort((a, b) => a.order - b.order);
    let setFocus;
    sorted.forEach((server) => {
      const recycle = oldviews.get(server.name);
      if (recycle && recycle.isVisible) {
        setFocus = recycle.name;
      }
      if (recycle && recycle.server.url === urlUtils.parseURL(server.url)) {
        oldviews.delete(recycle.name);
        this.views.set(recycle.name, recycle);
      } else {
        this.loadServer(server, mainWindow);
      }
    });
    oldviews.forEach((unused) => {
      unused.destroy();
    });
    if (setFocus) {
      this.showByName(setFocus);
    } else {
      this.showInitial();
    }
  }

  showInitial = () => {
    if (this.configServers.length) {
      // TODO: handle deeplink url
      const element = this.configServers.find((e) => e.order === 0);
      if (element) {
        this.showByName(element.name);
      }
    }

    // TODO: send event to highlight selected tab
  }

  showByName = (name) => {
    const newView = this.views.get(name);
    if (newView.isVisible) {
      return;
    }
    if (newView) {
      if (this.currentView && this.currentView !== name) {
        const previous = this.getCurrentView();
        if (previous) {
          previous.hide();
        }
      }

      this.currentView = name;
      const serverInfo = this.configServers.find((candidate) => candidate.name === newView.server.name);
      newView.window.webContents.send(SET_SERVER_KEY, serverInfo.order);
      if (newView.isReady()) {
        // if view is not ready, the renderer will have something to display instead.
        newView.show();
        contextMenu.reload(newView.getWebContents());
      } else {
        console.log(`couldn't show ${name}, not ready`);
      }
    } else {
      log.warn(`Couldn't find a view with name: ${name}`);
    }
    showModal();
  }

  focus = () => {
    const view = this.getCurrentView();
    if (view) {
      view.focus();
    }
  }
  activateView = (viewName) => {
    if (this.currentView === viewName) {
      this.showByName(this.currentView);
    }
  }

  getCurrentView() {
    return this.views.get(this.currentView);
  }

  openViewDevTools = () => {
    const view = this.getCurrentView();
    if (view) {
      view.openDevTools();
    } else {
      console.error(`couldn't find ${this.currentView}`);
    }
  }

  findByWebContent(webContentId) {
    let found = null;
    let serverName;
    let view;
    const entries = this.views.entries();

    for ([serverName, view] of entries) {
      if (typeof serverName !== 'undefined') {
        const wc = view.getWebContents();
        if (wc && wc.id === webContentId) {
          found = serverName;
        }
      }
    }
    return found;
  }

  showURLView = (url) => {
    if (this.urlViewCancel) {
      this.urlViewCancel();
    }
    const urlString = typeof url === 'string' ? url : url.toString();
    const urlView = new BrowserView();
    const query = new Map([['url', urlString]]);
    const localURL = getLocalURLString('urlView.html', query);
    urlView.webContents.loadURL(localURL);
    const currentWindow = this.getCurrentView().window;
    currentWindow.addBrowserView(urlView);
    const boundaries = currentWindow.getBounds();
    urlView.setBounds({
      x: 0,
      y: boundaries.height - URL_VIEW_HEIGHT,
      width: Math.floor(boundaries.width / 3),
      height: URL_VIEW_HEIGHT,
    });

    const hideView = () => {
      this.urlViewCancel = null;
      currentWindow.removeBrowserView(urlView);
      urlView.destroy();
    };

    const timeout = setTimeout(hideView,
      URL_VIEW_DURATION);

    this.urlViewCancel = () => {
      clearTimeout(timeout);
      hideView();
    };
  }
}
