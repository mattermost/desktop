// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserView} from 'electron';
import log from 'electron-log';

import {getWindowBoundaries} from '../utils';

const ACTIVE = 'active';
const SHOWING = 'showing';
const DONE = 'done';

export class ModalView {
    constructor(key, html, preload, data, onResolve, onReject, currentWindow) {
        this.key = key;
        this.html = html;
        this.data = data;
        log.info(`preloading with ${preload}`);
        this.view = new BrowserView({webPreferences: {
            contextIsolation: process.env.NODE_ENV !== 'test',
            preload,
            nodeIntegration: process.env.NODE_ENV === 'test',
            enableRemoteModule: process.env.NODE_ENV === 'test',
        }});
        this.onReject = onReject;
        this.onResolve = onResolve;
        this.window = currentWindow;
        this.windowAttached = null;
        this.status = ACTIVE;
        try {
            this.view.webContents.loadURL(this.html);
        } catch (e) {
            log.error('there was an error loading the modal:');
            log.error(e);
        }
    }

    show = (win, withDevTools) => {
        if (this.windowAttached) {
        // we'll reatach
            this.windowAttached.removeBrowserView(this.view);
        }
        this.windowAttached = win || this.window;

        this.windowAttached.addBrowserView(this.view);
        this.view.setBounds(getWindowBoundaries(this.windowAttached));
        this.view.setAutoResize({
            height: true,
            width: true,
            horizontal: true,
            vertical: true,
        });
        this.status = SHOWING;
        if (this.view.webContents.isLoading()) {
            this.view.webContents.once('did-finish-load', () => {
                this.view.webContents.focus();
            });
        } else {
            this.view.webContents.focus();
        }

        if (withDevTools) {
            log.info(`showing dev tools for ${this.key}`);
            this.view.webContents.openDevTools({mode: 'detach'});
        }
    }

    hide = () => {
        if (this.windowAttached) {
            if (this.view.webContents.isDevToolsOpened()) {
                this.view.webContents.closeDevTools();
            }
            this.windowAttached.removeBrowserView(this.view);

            // workaround to eliminate zombie processes
            // https://github.com/mattermost/desktop/pull/1519
            this.view.webContents.destroy();

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
