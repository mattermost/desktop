// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserView, app, shell, dialog} from 'electron';
import log from 'electron-log';

import {EventEmitter} from 'events';

import {RELOAD_INTERVAL, MAX_SERVER_RETRIES, SECOND} from 'common/utils/constants';
import urlUtils from 'common/utils/url';
import {LOAD_RETRY, LOAD_SUCCESS, LOAD_FAILED, UPDATE_TARGET_URL} from 'common/communication';
import {protocols} from '../../electron-builder.json';
const scheme = protocols[0].schemes[0];

import allowProtocolDialog from './allowProtocolDialog';
import downloadURL from './downloadURL';
import {getWindowBoundaries, getLocalPreload} from './utils';
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
    //this.view.webContents.on('new-window', this.handleNewWindow);
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

  handleNewWindow = (e, url) => {
    // Check for valid URL
    if (!urlUtils.isValidURI(url)) {
      e.preventDefault();
      return;
    }

    // Parse current and destination URLs
    const currentURL = urlUtils.parseURL(this.view.webContents.getURL());
    const destURL = urlUtils.parseURL(url);

    // Check for custom protocol
    if (destURL.protocol !== 'http:' && destURL.protocol !== 'https:' && destURL.protocol !== `${scheme}:`) {
      e.preventDefault();
      allowProtocolDialog.handleDialogEvent(destURL.protocol, url);
      return;
    }

    if (urlUtils.isInternalURL(destURL, currentURL, this.state.basename)) {
      // Download file case
      if (destURL.path.match(/^\/api\/v[3-4]\/public\/files\//)) {
        downloadURL(url, (err) => {
          if (err) {
            dialog.showMessageBox(WindowManager.getMainWindow(), {
              type: 'error',
              message: err.toString(),
            });
            log.error(err);
          }
        });
      } else if (destURL.path.match(/^\/help\//)) {
        // Help links case
        // continue to open special case internal urls in default browser
        shell.openExternal(url);
      } else if (urlUtils.isTeamUrl(this.props.src, url, true) || urlUtils.isAdminUrl(this.props.src, url)) {
        // Normal in-app behaviour case
        e.preventDefault();
        this.webviewRef.current.loadURL(url);
      } else if (urlUtils.isPluginUrl(this.props.src, url)) {
        // Plugin case
        // New window should disable nodeIntegration.
        window.open(url, app.name, 'nodeIntegration=no, contextIsolation=yes, show=yes');
      } else if (urlUtils.isManagedResource(this.props.src, url)) {
        // 'Trusted' URL case
        e.preventDefault();
      } else {
        e.preventDefault();
        shell.openExternal(url);
      }
    } else {
      const parsedURL = urlUtils.parseURL(url);
      const serverURL = urlUtils.getServer(parsedURL, this.props.teams);
      if (serverURL !== null && urlUtils.isTeamUrl(serverURL.url, parsedURL)) {
        this.props.handleInterTeamLink(parsedURL);
      } else {
        // if the link is external, use default os' application.
        allowProtocolDialog.handleDialogEvent(destURL.protocol, url);
      }
    }
  }
}
