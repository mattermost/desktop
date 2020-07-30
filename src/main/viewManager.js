// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import log from 'electron-log';

import {MattermostServer} from './MattermostServer';
import {MattermostView} from './MattermostView';

export class ViewManager {
  constructor(configServers) {
    this.configServers = configServers;
    this.views = new Map();
  }

  load = (mainWindow) => {
    this.configServers.forEach((server) => {
      log.info(server);
      const srv = new MattermostServer(server.name, server.url);
      const view = new MattermostView(srv, mainWindow);
      this.views.set(server.name, view);
      view.load();
    });
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
      if (view.server.name === name) {
        view.show(true);
        found = true;
      } else {
        view.hide();
      }
    });
    if (!found) {
      const restore = this.views.get(previous);
      restore.show(true);
    }
  }
}