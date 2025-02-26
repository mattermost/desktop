// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BrowserWindow} from 'electron';
import {WebContentsView} from 'electron';

import {Logger} from 'common/log';
import performanceMonitor from 'main/performanceMonitor';

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
    view: WebContentsView;
    onReject: (value: T2) => void;
    onResolve: (value: T2) => void;
    window: BrowserWindow;
    windowAttached?: BrowserWindow;
    status: Status;
    contextMenu: ContextMenu;
    uncloseable: boolean;
    private log: Logger;

    constructor(key: string, html: string, preload: string, data: T, onResolve: (value: T2) => void, onReject: (value: T2) => void, currentWindow: BrowserWindow, uncloseable: boolean) {
        this.key = key;
        this.html = html;
        this.data = data;
        this.log = new Logger('ModalView', key);
        this.log.info(`preloading with ${preload}`);
        this.view = new WebContentsView({webPreferences: {preload}});
        this.view.setBackgroundColor('#00000000');
        this.onReject = onReject;
        this.onResolve = onResolve;
        this.window = currentWindow;
        this.uncloseable = uncloseable;

        this.status = Status.ACTIVE;
        try {
            performanceMonitor.registerView(`Modal-${key}`, this.view.webContents);
            this.view.webContents.loadURL(this.html);
        } catch (e) {
            this.log.error('there was an error loading the modal:');
            this.log.error(e);
        }

        this.contextMenu = new ContextMenu({}, this.view.webContents);
    }

    show = (win?: BrowserWindow, withDevTools?: boolean) => {
        if (this.windowAttached) {
        // we'll reatach
            this.windowAttached.contentView.removeChildView(this.view);
        }
        this.windowAttached = win || this.window;

        this.windowAttached.contentView.addChildView(this.view);

        // Linux sometimes doesn't have the bound initialized correctly initially, so we wait to set them
        const setBoundsFunction = () => {
            if (this.windowAttached) {
                this.view.setBounds(getWindowBoundaries(this.windowAttached));
            }
        };
        if (process.platform === 'linux') {
            setTimeout(setBoundsFunction, 10);
        } else {
            setBoundsFunction();
        }

        this.status = Status.SHOWING;
        if (this.view.webContents.isLoading()) {
            this.view.webContents.once('did-finish-load', () => {
                this.view.webContents.focus();
            });
        } else {
            this.view.webContents.focus();
        }

        if (withDevTools) {
            this.log.info(`showing dev tools for ${this.key}`);
            this.view.webContents.openDevTools({mode: 'detach'});
        }
    };

    hide = () => {
        if (this.windowAttached) {
            if (this.view.webContents.isDevToolsOpened()) {
                this.view.webContents.closeDevTools();
            }
            performanceMonitor.unregisterView(this.view.webContents.id);
            this.windowAttached.contentView.removeChildView(this.view);
            this.view.webContents.close();

            delete this.windowAttached;
            this.status = Status.ACTIVE;
        }
    };

    handleInfoRequest = () => {
        return this.data;
    };

    reject = (data: T2) => {
        if (this.onReject) {
            this.onReject(data);
        }
        this.hide();
        this.status = Status.DONE;
    };

    resolve = (data: T2) => {
        if (this.onResolve) {
            this.onResolve(data);
        }
        this.hide();
        this.status = Status.DONE;
    };

    isActive = () => this.status !== Status.DONE;
}
