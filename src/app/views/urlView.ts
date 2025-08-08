// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BrowserWindow, IpcMainEvent} from 'electron';
import {ipcMain, WebContentsView} from 'electron';

import {SET_URL_FOR_URL_VIEW, UPDATE_URL_VIEW_WIDTH} from 'common/communication';
import {Logger} from 'common/log';
import {SECOND} from 'common/utils/constants';
import performanceMonitor from 'main/performanceMonitor';
import {getLocalPreload} from 'main/utils';

const log = new Logger('URLView');

const URL_VIEW_DURATION = 10 * SECOND;
const URL_VIEW_HEIGHT = 20;

export class URLView {
    private parent: BrowserWindow;
    private urlView: WebContentsView;
    private urlViewCancel?: () => void;

    constructor(parent: BrowserWindow) {
        this.parent = parent;

        this.urlView = new WebContentsView({webPreferences: {preload: getLocalPreload('internalAPI.js')}});
        this.urlView.setBackgroundColor('#00000000');
        this.urlView.webContents.loadURL('mattermost-desktop://renderer/urlView.html');

        parent.contentView.addChildView(this.urlView);
        performanceMonitor.registerView('URLView', this.urlView.webContents);
    }

    show = (url: URL | string) => {
        log.silly('showURLView', url);

        if (this.urlViewCancel) {
            this.urlViewCancel();
        }

        if (url && url !== '') {
            const urlString = typeof url === 'string' ? url : url.toString();

            if (this.urlView && !this.isViewInFront(this.urlView)) {
                this.parent.contentView.addChildView(this.urlView);
            }

            this.urlView.webContents.send(SET_URL_FOR_URL_VIEW, urlString);
            this.urlView.setVisible(true);

            const boundaries = this.parent.getBounds();

            const hideView = () => {
                delete this.urlViewCancel;

                this.urlView?.setVisible(false);
            };

            const adjustWidth = (event: IpcMainEvent, width: number) => {
                log.silly('showURLView.adjustWidth', width);

                if (!boundaries) {
                    return;
                }

                const bounds = {
                    x: 0,
                    y: boundaries.height - URL_VIEW_HEIGHT,
                    width: width + 5, // add some padding to ensure that we don't cut off the border
                    height: URL_VIEW_HEIGHT,
                };

                log.silly('showURLView.setBounds', boundaries, bounds);
                this.urlView.setBounds(bounds);
            };

            ipcMain.on(UPDATE_URL_VIEW_WIDTH, adjustWidth);

            const timeout = setTimeout(hideView,
                URL_VIEW_DURATION);

            this.urlViewCancel = () => {
                clearTimeout(timeout);
                ipcMain.removeListener(UPDATE_URL_VIEW_WIDTH, adjustWidth);
                hideView();
            };
        }
    };

    private isViewInFront = (view: WebContentsView) => {
        const index = this.parent.contentView.children.indexOf(view);
        const front = this.parent.contentView.children.length - 1;
        return index === front;
    };
}
