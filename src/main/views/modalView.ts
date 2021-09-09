// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserView, BrowserWindow} from 'electron';
import log from 'electron-log';

import ContextMenu from '../contextMenu';
import {getWindowBoundaries} from '../utils';

enum Status {
    ACTIVE,
    SHOWING,
    DONE
}

export class ModalView<T, T2> {
    key: string;
    html: string;
    data: T;
    view: BrowserView;
    onReject: (value: T2) => void;
    onResolve: (value: T2) => void;
    window: BrowserWindow;
    windowAttached?: BrowserWindow;
    status: Status;
    contextMenu: ContextMenu;

    constructor(key: string, html: string, preload: string, data: T, onResolve: (value: T2) => void, onReject: (value: T2) => void, currentWindow: BrowserWindow) {
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

        this.status = Status.ACTIVE;
        try {
            this.view.webContents.loadURL(this.html);
        } catch (e) {
            log.error('there was an error loading the modal:');
            log.error(e);
        }

        this.contextMenu = new ContextMenu({}, this.view);
    }

    show = (win?: BrowserWindow, withDevTools?: boolean) => {
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
        this.status = Status.SHOWING;
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
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            this.view.webContents.destroy();

            delete this.windowAttached;
            this.status = Status.ACTIVE;
        }
    }

    handleInfoRequest = () => {
        return this.data;
    }

    reject = (data: T2) => {
        if (this.onReject) {
            this.onReject(data);
        }
        this.hide();
        this.status = Status.DONE;
    }

    resolve = (data: T2) => {
        if (this.onResolve) {
            this.onResolve(data);
        }
        this.hide();
        this.status = Status.DONE;
    }

    isActive = () => this.status !== Status.DONE;
}
