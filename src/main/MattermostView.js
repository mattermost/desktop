// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserView, app, ipcMain} from 'electron';
import log from 'electron-log';

import {EventEmitter} from 'events';

import {RELOAD_INTERVAL, MAX_SERVER_RETRIES, SECOND} from 'common/utils/constants';
import urlUtils from 'common/utils/url';
import {LOAD_RETRY, LOAD_SUCCESS, LOAD_FAILED, UPDATE_TARGET_URL, IS_UNREAD, UNREAD_RESULT} from 'common/communication';

import {getWindowBoundaries, getLocalPreload} from './utils';
import * as WindowManager from './windows/windowManager';

// copying what webview sends
// TODO: review
const userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.146 Electron/6.1.7 Safari/537.36 Mattermost/${app.getVersion()}`;
const READY = 1;
const LOADING = 0;
const ERROR = -1;

const ASTERISK_GROUP = 3;
const MENTIONS_GROUP = 2;

export class MattermostView extends EventEmitter {
  constructor(server, win, options, updateBadge) {
    super();
    this.server = server;
    this.window = win;
    this.updateBadge = updateBadge;

    const preload = getLocalPreload('preload.js');
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

    /**
     * for backward compatibility when reading the title.
     * null means we have yet to figure out if it uses it or not but we consider it false until proven wrong
     */
    this.usesAsteriskForUnreads = null;

    this.faviconMemoize = new Map();
    this.currentFavicon = null;
    log.info(`BrowserView created for server ${this.server.name}`);
  }

  // use the same name as the server
  // TODO: we'll need unique identifiers if we have multiple instances of the same server in different tabs (1:N relationships)
  get name() {
    return this.server.name;
  }

  setReadyCallback = (func) => {
    this.readyCallBack = func;
    this.view.webContents.on('update-target-url', this.handleUpdateTarget);
  }

  load = (someURL) => {
    this.retryLoad = null;
    const loadURL = (typeof someURL === 'undefined') ? `${this.server.url.toString()}` : urlUtils.parseUrl(someURL);
    log.info(`[${this.server.name}] Loading ${loadURL}`);
    const loading = this.view.webContents.loadURL(loadURL, {userAgent});
    loading.then(this.loadSuccess(loadURL)).catch((err) => {
      this.loadRetry(loadURL, err);
    });
  }

  retry = (loadURL) => {
    return () => {
      // window was closed while retrying
      if (!this.view) {
        return;
      }
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
      if (this.status === LOADING) {
        this.view.webContents.on('page-title-updated', this.handleTitleUpdate);
        this.view.webContents.on('page-favicon-updated', this.handleFaviconUpdate);
        ipcMain.on(UNREAD_RESULT, this.handleFaviconIsUnread);
      }
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
    } else if (!request && this.isVisible) {
      this.window.removeBrowserView(this.view);
    }
    this.isVisible = request;
  }

  hide = () => this.show(false);

  setBounds = (boundaries) => {
    // todo: review this, as it might not work properly with devtools/minimizing/resizing
    this.view.setBounds(boundaries);
  }

  destroy = () => {
    if (this.retryLoad) {
      clearTimeout(this.retryLoad);
    }
    if (this.window) {
      this.window.removeBrowserView(this.view);
    }
    this.view.destroy();
    this.window = null;
    this.server = null;
    this.isVisible = false;
    clearTimeout(this.retryLoad);
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
    this.view.webContents.openDevTools({mode: 'detach'});
  }

  getWebContents = () => {
    if (this.status === READY) {
      return this.view.webContents;
    } else if (this.window) {
      return this.window.webContents; // if it's not ready you are looking at the renderer process
    }
    return WindowManager.getMainWindow.webContents;
  }

  handleUpdateTarget = (e, url) => {
    if (!this.server.sameOrigin(url)) {
      this.emit(UPDATE_TARGET_URL, url);
    }
  }

  titleParser = /(\((\d+)\) )?(\*)?/g

  handleTitleUpdate = (e, title) => {
    //const title = this.view.webContents.getTitle();
    const resultsIterator = title.matchAll(this.titleParser);
    const results = resultsIterator.next(); // we are only interested in the first set

    // if not using asterisk (version > v5.28), it'll be marked as undefined and wont be used to check if there are unread channels
    const hasAsterisk = results && results.value && results.value[ASTERISK_GROUP];
    if (typeof hasAsterisk !== 'undefined') {
      this.usesAsteriskForUnreads = true;
    }
    let unreads;
    if (this.usesAsteriskForUnreads) {
      unreads = Boolean(hasAsterisk);
    }
    const mentions = (results && results.value && results.value[MENTIONS_GROUP]) || 0;
    this.updateBadge(this.server.name, mentions, unreads);
    //WindowManager.sendToRenderer(UPDATE_MENTIONS, this.server.name, mentions, unreads);
  }

  handleFaviconUpdate = (e, favicons) => {
    if (!this.usesAsteriskForUnreads) {
      // if unread state is stored for that favicon, retrieve value.
      // if not, get related info from preload and store it for future changes
      this.currentFavicon = favicons[0];
      if (this.faviconMemoize.has(favicons[0])) {
        this.updateBadge(this.server.name, null, this.faviconMemoize.get(favicons[0]));
        //WindowManager.sendToRenderer(UPDATE_UNREADS, this.server.name, this.faviconMemoize.get(favicons[0]));
      } else {
        this.findUnreadState(favicons[0]);
      }
    }
  }

  findUnreadState = (favicon) => {
    this.view.webContents.send(IS_UNREAD, favicon);
  }

  handleFaviconIsUnread = (e, favicon, result) => {
    this.faviconMemoize.set(favicon, result);
    if (favicon === this.currentFavicon) {
      this.updateBadge(this.server.name, null, result);
      //WindowManager.sendToRenderer(UPDATE_UNREADS, this.server.name, result);
    }
  }
}
