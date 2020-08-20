// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import log from 'electron-log';

import {MattermostServer} from './MattermostServer';
import {MattermostView} from './MattermostView';

export class ViewManager {
  constructor(configServers) {
    this.configServers = configServers;
    this.views = new Map(); // keep in mind that this doesn't need to hold server order, only tabs on the renderer need that.
  }

  // TODO: we shouldn't pass the main window, but get it from windowmanager
  // TODO: we'll need an event in case the main window changes so this updates accordingly
  load = (mainWindow) => {
    this.configServers.forEach((server) => {
      log.info(server);
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

    //TODO: think of a more gradual approach, this would reload all tabs but in most cases they will be the same or have small variation
    for (const view of oldviews.values()) {
      view.destroy();
    }
  }

  showInitial = () => {
    // TODO: handle deeplink url
    const element = this.configServers.find((e) => e.order === 0);
    this.showByName(element.name);
  }

  showByName = (name) => {
    let previous;
    let found = false;
    this.views.forEach((view) => {
      if (view.isVisible) {
        previous = view.name;
      }

      // TODO: this is a map, we can probably improve this search
      if (view.server.name === name) {
        log.info(`switching view to ${name}`);
        view.show(true);
        found = true;
      } else {
        view.hide();
      }
    });
    if (!found) {
      log.warn(`Couldn't find a view with name: ${name}`);
      const restore = this.views.get(previous);
      restore.show(true);
    }
  }
}