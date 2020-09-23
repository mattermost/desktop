// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import log from 'electron-log';

import {MattermostServer} from './MattermostServer';
import {MattermostView} from './MattermostView';

export class ViewManager {
  constructor(configServers) {
    this.configServers = configServers;
    this.views = new Map(); // keep in mind that this doesn't need to hold server order, only tabs on the renderer need that.
    this.currentView = null;
  }

  // TODO: we shouldn't pass the main window, but get it from windowmanager
  // TODO: we'll need an event in case the main window changes so this updates accordingly
  load = (mainWindow) => {
    this.configServers.forEach((server) => {
      const srv = new MattermostServer(server.name, server.url);
      const view = new MattermostView(srv, mainWindow);
      this.views.set(server.name, view);
      view.load();
    });
  }

  reloadConfiguration = (configServers, mainWindow) => {
    this.configServers = configServers;
    const oldviews = this.views;
    this.views = new Map();
    this.load(mainWindow);

    let newView = null;

    //TODO: think of a more gradual approach, this would reload all tabs but in most cases they will be the same or have small variation
    for (const view of oldviews.values()) {
      // try to restore view to the same tab if possible, but if not use initial one
      if (view.isVisible) {
        log.info(`will try to restore ${view.name}`);
        newView = this.views.get(view.name);
      }
      view.destroy();
    }
    if (newView) {
      log.info('restoring view');
      newView.show(true);
    } else {
      log.info('couldn\'t find original view');
      this.showInitial();
    }
  }

  showInitial = () => {
    // TODO: handle deeplink url
    const element = this.configServers.find((e) => e.order === 0);
    this.showByName(element.name);

    // TODO: send event to highlight selected tab
  }

  showByName = (name) => {
    const newView = this.views.get(name);
    if (newView) {
      if (this.currentView) {
        const previous = this.views.get(this.currentView);
        previous.hide();
      }
      this.currentView = name;
      newView.show();
    } else {
      log.warn(`Couldn't find a view with name: ${name}`);
    }
  }

  focus = () => {
    const view = this.views.get(this.currentView);
    if (view) {
      view.focus();
    }
  }
}