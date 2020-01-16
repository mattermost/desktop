// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {parse as parseUrl} from 'url';

import {BrowserView, app, ipcMain} from 'electron';

const preloadJS = `file://${app.getAppPath()}/browser/webview/mattermost_bundle.js`;

export class View extends BrowserView {
  constructor(window, url) {
    super({
      webPreferences: {
        preload: preloadJS,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        enableRemoteModule: false,
        partition: 'persist:view',
        plugins: true,
        nativeWindowOpen: true,
        webSecurity: true,
        javascript: true,
      },
    });

    this.updateURL = this.updateURL.bind(this);

    this.title = '';
    this.url = '';
    this.homeUrl = url;
    this.favicon = '';

    this.errorURL = '';

    this.window = window;

    // this.webContents.addEventListener('ipc-message', (event) => {
    //   switch (event.channel) {
    //   case 'onGuestInitialized':
    //     self.setState({
    //       isLoaded: true,
    //       basename: event.args[0] || '/',
    //     });
    //     break;
    //   case 'onBadgeChange': {
    //     self.handleUnreadCountChange(...event.args);
    //     break;
    //   }
    //   case 'dispatchNotification': {
    //     self.dispatchNotification(...event.args);
    //     break;
    //   }
    //   case 'onNotificationClick':
    //     self.props.onNotificationClick();
    //     break;
    //   case 'mouse-move':
    //     this.handleMouseMove(event.args[0]);
    //     break;
    //   case 'mouse-up':
    //     this.handleMouseUp();
    //     break;
    //   }
    // });

    ipcMain.on(`get-error-url-${this.webContents.id}`, async () => {
      return this.errorURL;
    });

    this.webContents.on('context-menu', () => {
      // TODO: handle on context-menu
      // const menu = getViewMenu(this.window, params, this.webContents);
      // menu.popup();
    });

    this.webContents.addListener('page-title-updated', (e, title) => {
      this.title = title;

      this.window.webContents.send(
        `view-title-updated-${this.webContents.id}`,
        title,
      );
    });

    this.webContents.addListener('did-navigate', async (e, eventUrl) => {
      this.window.webContents.send(
        `view-did-navigate-${this.webContents.id}`,
        url,
      );

      this.updateURL(eventUrl);
    });

    this.webContents.addListener(
      'did-navigate-in-page',
      async (e, eventUrl, isMainFrame) => {
        if (isMainFrame) {
          this.window.webContents.send(
            `view-did-navigate-${this.webContents.id}`,
            url,
          );

          this.updateURL(eventUrl);
        }
      },
    );

    this.webContents.addListener('did-stop-loading', () => {
      this.window.webContents.send(
        `view-loading-${this.webContents.id}`,
        false,
      );
    });

    this.webContents.addListener('did-start-loading', () => {
      this.window.webContents.send(`view-loading-${this.webContents.id}`, true);
    });

    this.webContents.addListener('did-start-navigation', async (...args) => {

      this.favicon = '';

      this.window.webContents.send(
        `load-commit-${this.webContents.id}`,
        ...args,
      );
    });

    this.webContents.addListener(
      'did-fail-load',
      (e, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (isMainFrame) {
          this.errorURL = validatedURL;

          // this.webContents.loadURL(``);
        }
      },
    );

    this.webContents.addListener(
      'page-favicon-updated',
      async (e, favicons) => {
        this.favicon = favicons[0];

        try {
          const fav = this.favicon;

          this.window.webContents.send(
            `update-tab-favicon-${this.webContents.id}`,
            fav,
          );
        } catch (error) {
          this.favicon = '';
          console.error(error);
        }
      },
    );

    this.webContents.addListener('did-change-theme-color', (e, color) => {
      this.window.webContents.send(
        `browserview-theme-color-updated-${this.webContents.id}`,
        color,
      );
    });

    this.webContents.addListener(
      'certificate-error',
      (
        event,
        eventUrl,
        error,
        certificate,
        callback,
      ) => {
        console.log(certificate, error, eventUrl);

        // TODO: properly handle insecure websites.
        event.preventDefault();
        callback(true);
      },
    );

    this.setAutoResize({
      width: true,
      height: true,
    });
    this.webContents.loadURL(url);
  }

  updateURL(url) {
    if (this.url === url) {
      return;
    }

    this.url = url;

    this.window.webContents.send(
      `view-url-updated-${this.webContents.id}`,
      url,
    );
  }

  get hostname() {
    return parseUrl(this.url).hostname;
  }
}
