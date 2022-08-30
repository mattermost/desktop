// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserWindow, ipcMain, shell} from 'electron';
import {IpcMainEvent, IpcMainInvokeEvent} from 'electron/main';

import log from 'electron-log';

import {CombinedConfig} from 'types/config';

import {
    RETRIEVE_MODAL_INFO,
    MODAL_CANCEL,
    MODAL_RESULT,
    MODAL_OPEN,
    MODAL_CLOSE,
    EMIT_CONFIGURATION,
    DARK_MODE_CHANGE,
    GET_MODAL_UNCLOSEABLE,
    RESIZE_MODAL,
    URL_OPEN_EXTERNAL,
} from 'common/communication';
import {MM_LINKS} from 'common/utils/constants';

import {getAdjustedWindowBoundaries} from 'main/utils';
import WindowManager from 'main/windows/windowManager';

import {ModalView} from './modalView';

export class ModalManager {
    modalQueue: Array<ModalView<any, any>>;
    modalPromises: Map<string, Promise<any>>;

    constructor() {
        this.modalQueue = [];
        this.modalPromises = new Map();

        ipcMain.handle(GET_MODAL_UNCLOSEABLE, this.handleGetModalUncloseable);
        ipcMain.handle(RETRIEVE_MODAL_INFO, this.handleInfoRequest);
        ipcMain.on(MODAL_RESULT, this.handleModalResult);
        ipcMain.on(MODAL_CANCEL, this.handleModalCancel);
        ipcMain.on(RESIZE_MODAL, this.handleResizeModal);
        ipcMain.on(URL_OPEN_EXTERNAL, this.handleOpenExternalMMLink);

        ipcMain.on(EMIT_CONFIGURATION, this.handleEmitConfiguration);
    }

    // TODO: add a queue/add differentiation, in case we need to put a modal first in line
    addModal = <T, T2>(key: string, html: string, preload: string, data: T, win: BrowserWindow, uncloseable = false) => {
        const foundModal = this.modalQueue.find((modal) => modal.key === key);
        if (!foundModal) {
            const modalPromise = new Promise((resolve: (value: T2) => void, reject) => {
                const mv = new ModalView<T, T2>(key, html, preload, data, resolve, reject, win, uncloseable);
                this.modalQueue.push(mv);
            });

            if (this.modalQueue.length === 1) {
                this.showModal();
            }

            this.modalPromises.set(key, modalPromise);
            return modalPromise;
        }
        return this.modalPromises.get(key) as Promise<T2>;
    }

    findModalByCaller = (event: IpcMainInvokeEvent) => {
        if (this.modalQueue.length) {
            const requestModal = this.modalQueue.find((modal) => {
                return (modal.view && modal.view.webContents && modal.view.webContents.id === event.sender.id);
            });
            return requestModal;
        }
        return null;
    }

    handleInfoRequest = (event: IpcMainInvokeEvent) => {
        log.debug('ModalManager.handleInfoRequest');

        const requestModal = this.findModalByCaller(event);
        if (requestModal) {
            return requestModal.handleInfoRequest();
        }
        return null;
    }

    showModal = () => {
        const withDevTools = process.env.MM_DEBUG_MODALS || false;
        this.modalQueue.forEach((modal, index) => {
            if (index === 0) {
                WindowManager.sendToRenderer(MODAL_OPEN);
                modal.show(undefined, Boolean(withDevTools));
            } else {
                WindowManager.sendToRenderer(MODAL_CLOSE);
                modal.hide();
            }
        });
    }

    handleModalFinished = (mode: 'resolve' | 'reject', event: IpcMainEvent, data: unknown) => {
        log.debug('ModalManager.handleModalFinished', {mode, data});

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
        if (this.modalQueue.length) {
            this.showModal();
        } else {
            WindowManager.sendToRenderer(MODAL_CLOSE);
            WindowManager.focusBrowserView();
        }
    }

    handleModalResult = (event: IpcMainEvent, data: unknown) => this.handleModalFinished('resolve', event, data);

    handleModalCancel = (event: IpcMainEvent, data: unknown) => this.handleModalFinished('reject', event, data);

    filterActive = () => {
        this.modalQueue = this.modalQueue.filter((modal) => modal.isActive());
    }

    isModalDisplayed = () => {
        return this.modalQueue.some((modal) => modal.isActive());
    }

    handleResizeModal = (event: IpcMainEvent, bounds: Electron.Rectangle) => {
        log.debug('ModalManager.handleResizeModal', bounds);

        if (this.modalQueue.length) {
            const currentModal = this.modalQueue[0];
            const {width, height} = bounds;

            currentModal.view.setBounds(getAdjustedWindowBoundaries(width, height));
            currentModal.view.webContents.send(RESIZE_MODAL, {width, height});
        }
    }

    focusCurrentModal = () => {
        if (this.isModalDisplayed()) {
            this.modalQueue[0].view.webContents.focus();
        }
    }

    handleEmitConfiguration = (event: IpcMainEvent, config: CombinedConfig) => {
        if (this.modalQueue.length) {
            log.debug('ModalManager.handleEmitConfiguration');
        }

        this.modalQueue.forEach((modal) => {
            modal.view.webContents.send(DARK_MODE_CHANGE, config.darkMode);
        });
    }

    handleGetModalUncloseable = (event: IpcMainInvokeEvent) => {
        const modalView = this.modalQueue.find((modal) => modal.view.webContents.id === event.sender.id);
        return modalView?.uncloseable;
    }

    handleOpenExternalMMLink = (event: IpcMainEvent, url: string) => {
        if (Object.values(MM_LINKS).includes(url)) {
            log.debug('ModalManager.handleOpenExternal', url);

            shell.openExternal(url);
        }
    }
}

const modalManager = new ModalManager();
export default modalManager;
