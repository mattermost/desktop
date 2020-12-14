// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserView, app, net} from 'electron';
import log from 'electron-log';
import path from 'path';

import {EventEmitter} from 'events';

import {RELOAD_INTERVAL, MAX_SERVER_RETRIES, SECOND} from 'common/utils/constants';
import Utils from 'common/utils/util';
import {LOAD_RETRY, LOAD_SUCCESS, LOAD_FAILED, UPDATE_TARGET_URL} from 'common/communication';

import {getWindowBoundaries} from './utils';
import * as WindowManager from './windows/windowManager';

// copying what webview sends
// TODO: review
const userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.146 Electron/6.1.7 Safari/537.36 Mattermost/${app.getVersion()}`;
const READY = 1;
const LOADING = 0;
const ERROR = -1;

export class MattermostView extends EventEmitter {
  constructor(server, win, options) {
    super();
    this.server = server;
    this.window = win;

    const preload = path.resolve(__dirname, '../../dist/preload.js');
    const spellcheck = ((!options || typeof options.spellcheck === 'undefined') ? true : options.spellcheck);
    this.options = {
      webPreferences: {
        preload,
        spellcheck,
        additionalArguments: [
          `version=${app.version}`,
          `appName=${app.name}`,
        ]
      },
      ...options
    };
    this.isVisible = false;
    this.view = new BrowserView(this.options);
    this.retryLoad = null;
    this.maxRetries = MAX_SERVER_RETRIES;
    this.status = LOADING;
    log.info(`BrowserView created for server ${this.server.name}`);
  }

  // use the same name as the server
  // TODO: we'll need unique identifiers if we have multiple instances of the same server in different tabs (1:N relationships)
  get name() {
    return this.server.name;
  }

  getUserTheme = async () => {
    const cookies = await this.view.webContents.session.cookies.get({});
    if (!cookies) {
      // Couldn't get cookies
      WindowManager.sendToRenderer('use-default-theme');
      return;
    }

    // Filter out cookies that aren't part of our domain
    const filteredCookies = cookies.filter((cookie) => String(this.server.url).indexOf(cookie.domain) >= 0);

    const userId = filteredCookies.find((cookie) => cookie.name === 'MMUSERID');
    const csrf = filteredCookies.find((cookie) => cookie.name === 'MMCSRF');
    const authToken = filteredCookies.find((cookie) => cookie.name === 'MMAUTHTOKEN');

    if (!userId || !csrf || !authToken) {
      // Missing cookies needed for req
      WindowManager.sendToRenderer('use-default-theme');
      return;
    }

    const prefUrl = `${this.server.url}/api/v4/users/${userId.value}/preferences`;
    const req = net.request({
      url: prefUrl,
      session: this.view.webContents.session,
      useSessionCookies: true,
    });

    req.on('response', this.handleUserTheme);
    req.on('aborted', () => WindowManager.sendToRenderer('use-default-theme'));
    req.on('error', (error) => {
      log.error(error);
      WindowManager.sendToRenderer('use-default-theme');
    });
    req.end();
  };

  handleUserTheme = (resp) => {
    resp.on('data', (data) => {
      const prefsRaw = `${data}`;
      const prefs = JSON.parse(prefsRaw);
      if (!Array.isArray(prefs)) {
        log.error(prefs);
        WindowManager.sendToRenderer('use-default-theme');
        return;
      }

      const themePrefs = prefs.filter((pref) => pref.category === 'theme');
      if (themePrefs && themePrefs.length) {
        // use custom theme
        const themePref = themePrefs.find((pref) => pref.name === '');
        const themeData = JSON.parse(themePref.value);
        WindowManager.sendToRenderer('use-custom-theme', themeData);
      } else {
        // use default dark/light mode theme
        WindowManager.sendToRenderer('use-default-theme');
      }
    });

    resp.on('aborted', () => WindowManager.sendToRenderer('use-default-theme'));

    resp.on('error', (error) => {
      log.error(error);
      WindowManager.sendToRenderer('use-default-theme');
    });
  }

  setReadyCallback = (func) => {
    this.readyCallBack = func;
    this.view.webContents.on('update-target-url', this.handleUpdateTarget);
  }

  load = (someURL) => {
    this.retryLoad = null;
    const loadURL = (typeof someURL === 'undefined') ? `${this.server.url.toString()}` : Utils.parseUrl(someURL);
    log.info(`[${this.server.name}] Loading ${loadURL}`);
    const loading = this.view.webContents.loadURL(loadURL, {userAgent});
    loading.then(this.loadSuccess(loadURL)).catch((err) => {
      this.loadRetry(loadURL, err);
    });
  }

  retry = (loadURL) => {
    return () => {
      const loading = this.view.webContents.loadURL(loadURL, {userAgent});
      loading.then(this.loadSuccess(loadURL)).catch((err) => {
        if (this.maxRetries-- > 0) {
          this.loadRetry(loadURL, err);
        } else {
          WindowManager.sendToRenderer(LOAD_FAILED, this.server.name, err.toString(), loadURL.toString());
          log.info(`[${this.server.name}] Couldn't stablish a connection with ${loadURL}: ${err}.`);
          this.status = ERROR;
        }
      });
    };
  }

  loadRetry = (loadURL, err) => {
    this.retryLoad = setTimeout(this.retry(loadURL), RELOAD_INTERVAL);
    WindowManager.sendToRenderer(LOAD_RETRY, this.server.name, Date.now() + RELOAD_INTERVAL, err.toString(), loadURL.toString());
    log.info(`[${this.server.name}] failed loading ${loadURL}: ${err}, retrying in ${RELOAD_INTERVAL / SECOND} seconds`);
  }

  loadSuccess = (loadURL) => {
    return () => {
      log.info(`[${this.server.name}] finished loading ${loadURL}`);
      WindowManager.sendToRenderer(LOAD_SUCCESS, this.server.name);
      this.maxRetries = MAX_SERVER_RETRIES;
      this.status = READY;
      if (this.readyCallBack) {
        this.readyCallBack(this.server.name);
      }
    };
  }

  show = (requestedVisibility) => {
    const request = typeof requestedVisibility === 'undefined' ? true : requestedVisibility;
    if (request && !this.isVisible) {
      this.window.addBrowserView(this.view);
      this.setBounds(getWindowBoundaries(this.window));
      this.getUserTheme();
    } else if (!request && this.isVisible) {
      this.window.removeBrowserView(this.view);
    }
    this.isVisible = request;
  }

  hide = () => this.show(false);

  setBounds = (boundaries) => {
    // todo: review this, as it might not work properly with devtools/minimizing/resizing
    this.view.setBounds(boundaries);
    this.view.setAutoResize({
      height: true,
      width: true,
      horizontal: true,
      vertical: true,
    });
  }

  destroy = () => {
    if (this.window) {
      this.window.removeBrowserView(this.view);
    }
    this.view.destroy();
    this.window = null;
    this.server = null;
    this.isVisible = false;
  }

  focus = () => {
    if (this.view.webContents) {
      this.view.webContents.focus();
    } else {
      log.warn('trying to focus the browserview, but it doesn\'t yet have webcontents.');
    }
  }

  isReady = () => {
    return this.status === READY;
  }

  openDevTools = () => {
    this.view.webContents.openDevTools();
  }

  getWebContents = () => {
    if (this.status === READY) {
      return this.view.webContents;
    }
    return this.window.webContents; // if it's not ready you are looking at the renderer process
  }

  handleUpdateTarget = (e, url) => {
    if (!this.server.sameOrigin(url)) {
      this.emit(UPDATE_TARGET_URL, url);
    }
  }
}
