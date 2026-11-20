// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BrowserWindow} from 'electron';
import {ipcMain} from 'electron';
import type {IpcMainEvent, IpcMainInvokeEvent} from 'electron/main';
import {EventEmitter} from 'events';

import MainWindow from 'app/mainWindow/mainWindow';
import TabManager from 'app/tabs/tabManager';
import WebContentsEventManager from 'app/views/webContentEvents';
import AppState from 'common/appState';
import {
    RETRIEVE_MODAL_INFO,
    MODAL_CANCEL,
    MODAL_RESULT,
    MODAL_OPEN,
    MODAL_CLOSE,
    EMIT_CONFIGURATION,
    GET_MODAL_UNCLOSEABLE,
    MAIN_WINDOW_RESIZED,
    RELOAD_CONFIGURATION,
    SERVER_REMOVED,
    SERVER_SWITCHED,
} from 'common/communication';
import {Logger} from 'common/log';
import type {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';
import NotificationManager from 'main/notifications';
import {getAdjustedWindowBoundaries} from 'main/utils';

import {ModalView} from './modalView';

const log = new Logger('ModalManager');

export class ModalManager extends EventEmitter {
    modalQueue: Array<ModalView<any, any>>;
    modalPromises: Map<string, Promise<any>>;

    constructor() {
        super();

        this.modalQueue = [];
        this.modalPromises = new Map();

        ipcMain.handle(GET_MODAL_UNCLOSEABLE, this.handleGetModalUncloseable);
        ipcMain.handle(RETRIEVE_MODAL_INFO, this.handleInfoRequest);
        ipcMain.on(MODAL_RESULT, this.handleModalResult);
        ipcMain.on(MODAL_CANCEL, this.handleModalCancel);
        MainWindow.on(MAIN_WINDOW_RESIZED, this.handleResizeModal);
        ServerManager.on(SERVER_SWITCHED, this.showModal);
        ServerManager.on(SERVER_REMOVED, this.handleServerRemoved);

        ipcMain.on(EMIT_CONFIGURATION, this.handleEmitConfiguration);
    }

    addModal = <T, T2>(key: string, html: string, preload: string, data: T, win: BrowserWindow, uncloseable = false, serverId?: string) => {
        return this.enqueueModal<T, T2>(key, html, preload, data, win, uncloseable, false, serverId);
    };

    addPriorityModal = <T, T2>(key: string, html: string, preload: string, data: T, win: BrowserWindow, uncloseable = false, serverId?: string) => {
        return this.enqueueModal<T, T2>(key, html, preload, data, win, uncloseable, true, serverId);
    };

    private enqueueModal = <T, T2>(key: string, html: string, preload: string, data: T, win: BrowserWindow, uncloseable: boolean, priority: boolean, serverId?: string) => {
        const foundModal = this.modalQueue.find((modal) => modal.key === key);
        if (foundModal) {
            return this.modalPromises.get(key) as Promise<T2>;
        }

        const isServerInView = serverId === ServerManager.getCurrentServerId() && MainWindow.get()?.isFocused();
        if (serverId && !isServerInView && !this.modalQueue.some((modal) => modal.serverId === serverId)) {
            NotificationManager.displayServerModal(serverId);
        }

        const modalPromise = new Promise((resolve: (value: T2) => void, reject) => {
            const mv = new ModalView<T, T2>(key, html, preload, data, resolve, reject, win, uncloseable, serverId);

            if (priority) {
                this.modalQueue.unshift(mv);
            } else {
                this.modalQueue.push(mv);
            }
        });

        if (serverId) {
            AppState.updatePendingModal(serverId, true);
        }

        if (this.getVisibleModal()?.key === key) {
            this.showModal();
        }

        this.modalPromises.set(key, modalPromise);
        return modalPromise;
    };

    removeModal = (key: string) => {
        const modalView = this.modalQueue.find((modal) => modal.key === key);
        if (!modalView) {
            return;
        }

        modalView.resolve(null);
        this.modalPromises.delete(key);
        this.filterActive();
        if (modalView.serverId) {
            this.updatePendingModal(modalView.serverId);
        }
    };

    findModalByCaller = (event: IpcMainInvokeEvent) => {
        if (this.modalQueue.length) {
            const requestModal = this.modalQueue.find((modal) => {
                return (modal.view && modal.view.webContents && modal.view.webContents.id === event.sender.id);
            });
            return requestModal;
        }
        return null;
    };

    handleInfoRequest = (event: IpcMainInvokeEvent) => {
        log.debug('handleInfoRequest');

        const requestModal = this.findModalByCaller(event);
        if (requestModal) {
            return requestModal.handleInfoRequest();
        }
        return null;
    };

    showModal = () => {
        const withDevTools = process.env.MM_DEBUG_MODALS || false;
        const visibleModal = this.getVisibleModal();
        this.modalQueue.forEach((modal) => {
            if (modal === visibleModal) {
                MainWindow.sendToRenderer(MODAL_OPEN, Boolean(modal.serverId));
                modal.show(undefined, Boolean(withDevTools));
                WebContentsEventManager.addWebContentsEventListeners(modal.view.webContents);
                this.emit(MODAL_OPEN, Boolean(modal.serverId));
            } else {
                modal.suspend();
            }
        });
        if (!visibleModal) {
            MainWindow.sendToRenderer(MODAL_CLOSE);
        }
    };

    handleModalFinished = (mode: 'resolve' | 'reject', event: IpcMainEvent, data: unknown) => {
        log.debug('handleModalFinished', {mode});

        const requestModal = this.findModalByCaller(event);
        if (requestModal) {
            if (mode === 'resolve') {
                requestModal.resolve(data);
            } else {
                requestModal.reject(data);
            }
            this.modalPromises.delete(requestModal.key);
        }
        this.filterActive();
        if (requestModal?.serverId) {
            this.updatePendingModal(requestModal.serverId);
        }
        this.showModal();
        if (!this.isModalDisplayed()) {
            TabManager.focusCurrentTab();
        }
    };

    handleModalResult = (event: IpcMainEvent, data: unknown) => this.handleModalFinished('resolve', event, data);

    handleModalCancel = (event: IpcMainEvent, data: unknown) => this.handleModalFinished('reject', event, data);

    filterActive = () => {
        this.modalQueue = this.modalQueue.filter((modal) => modal.isActive());
    };

    isModalDisplayed = () => {
        return Boolean(this.getVisibleModal());
    };

    handleResizeModal = (bounds: Electron.Rectangle) => {
        log.debug('handleResizeModal', {bounds, modalQueueLength: this.modalQueue.length});

        this.getVisibleModal()?.view.setBounds(getAdjustedWindowBoundaries(bounds.width, bounds.height));
    };

    focusCurrentModal = () => {
        if (MainWindow.get()?.isFocused()) {
            this.getVisibleModal()?.view.webContents.focus();
        }
    };

    handleEmitConfiguration = () => {
        if (this.modalQueue.length) {
            log.debug('handleEmitConfiguration');
        }

        this.modalQueue.forEach((modal) => {
            modal.view.webContents.send(RELOAD_CONFIGURATION);
        });
    };

    handleGetModalUncloseable = (event: IpcMainInvokeEvent) => {
        const modalView = this.modalQueue.find((modal) => modal.view.webContents.id === event.sender.id);
        return modalView?.uncloseable;
    };

    private handleServerRemoved = (server: MattermostServer) => {
        this.modalQueue.filter((modal) => modal.serverId === server.id).forEach((modal) => {
            modal.reject(undefined);
            this.modalPromises.delete(modal.key);
        });
        this.filterActive();
        this.showModal();
    };

    private updatePendingModal = (serverId: string) => {
        AppState.updatePendingModal(serverId, this.modalQueue.some((modal) => modal.serverId === serverId));
    };

    private getVisibleModal = () => {
        const currentServerId = ServerManager.getCurrentServerId();
        return this.modalQueue.find((modal) => !modal.serverId || modal.serverId === currentServerId);
    };
}

const modalManager = new ModalManager();
export default modalManager;
