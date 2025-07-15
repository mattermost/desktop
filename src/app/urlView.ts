// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent} from 'electron';
import {ipcMain, WebContentsView} from 'electron';

import TabManager from 'app/tabs/tabManager';
import {MAIN_WINDOW_CREATED, SET_URL_FOR_URL_VIEW, UPDATE_URL_VIEW_WIDTH} from 'common/communication';
import {Logger} from 'common/log';
import {SECOND, TAB_BAR_HEIGHT} from 'common/utils/constants';
import performanceMonitor from 'main/performanceMonitor';
import {getLocalPreload} from 'main/utils';
import MainWindow from 'main/windows/mainWindow';

const log = new Logger('URLView');

const URL_VIEW_DURATION = 10 * SECOND;
const URL_VIEW_HEIGHT = 20;

export class URLView {
    private urlView?: WebContentsView;
    private urlViewCancel?: () => void;

    constructor() {
        MainWindow.on(MAIN_WINDOW_CREATED, this.init);
    }

    init = () => {
        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            return;
        }

        const urlView = new WebContentsView({webPreferences: {preload: getLocalPreload('internalAPI.js')}});
        urlView.setBackgroundColor('#00000000');

        urlView.webContents.loadURL('mattermost-desktop://renderer/urlView.html');

        MainWindow.get()?.contentView.addChildView(urlView);

        performanceMonitor.registerView('URLView', urlView.webContents);

        this.urlView = urlView;
    };

    show = (url: URL | string) => {
        log.silly('showURLView', url);

        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            return;
        }

        if (this.urlViewCancel) {
            this.urlViewCancel();
        }

        if (url && url !== '') {
            const urlString = typeof url === 'string' ? url : url.toString();

            if (this.urlView && !this.isViewInFront(this.urlView)) {
                log.silly('moving URL view to front');
                MainWindow.get()?.contentView.addChildView(this.urlView);
            }

            this.urlView?.webContents.send(SET_URL_FOR_URL_VIEW, urlString);
            this.urlView?.setVisible(true);

            // TODO: Will need to account for multiple windows
            const boundaries = TabManager.getCurrentActiveTabView()?.getBounds() ?? MainWindow.getBounds();

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
                    y: (boundaries.height + TAB_BAR_HEIGHT) - URL_VIEW_HEIGHT,
                    width: width + 5, // add some padding to ensure that we don't cut off the border
                    height: URL_VIEW_HEIGHT,
                };

                log.silly('showURLView.setBounds', boundaries, bounds);
                this.urlView?.setBounds(bounds);
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
        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            return false;
        }

        const index = mainWindow.contentView.children.indexOf(view);
        const front = mainWindow.contentView.children.length - 1;
        return index === front;
    };
}

const urlView = new URLView();
export default urlView;
