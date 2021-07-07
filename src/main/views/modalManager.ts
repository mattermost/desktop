// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserWindow, ipcMain} from 'electron';
import {IpcMainEvent, IpcMainInvokeEvent} from 'electron/main';

import {CombinedConfig} from 'types/config';

import {RETRIEVE_MODAL_INFO, MODAL_CANCEL, MODAL_RESULT, MODAL_OPEN, MODAL_CLOSE, DARK_MODE_CHANGE} from 'common/communication';

import * as WindowManager from '../windows/windowManager';

import {ModalView} from './modalView';

let modalQueue: Array<ModalView<any, any>> = [];

// TODO: add a queue/add differentiation, in case we need to put a modal first in line
// should we return the original promise if called multiple times with the same key?
export function addModal<T, T2>(key: string, html: string, preload: string, data: T, win: BrowserWindow) {
    const foundModal = modalQueue.find((modal) => modal.key === key);
    if (!foundModal) {
        const modalPromise = new Promise((resolve: (value: T2) => void, reject) => {
            const mv = new ModalView<T, T2>(key, html, preload, data, resolve, reject, win);
            modalQueue.push(mv);
        });

        if (modalQueue.length === 1) {
            showModal();
        }

        return modalPromise;
    }
    return null;
}

ipcMain.handle(RETRIEVE_MODAL_INFO, handleInfoRequest);
ipcMain.on(MODAL_RESULT, handleModalResult);
ipcMain.on(MODAL_CANCEL, handleModalCancel);

function findModalByCaller(event: IpcMainInvokeEvent) {
    if (modalQueue.length) {
        const requestModal = modalQueue.find((modal) => {
            return (modal.view && modal.view.webContents && modal.view.webContents.id === event.sender.id);
        });
        return requestModal;
    }
    return null;
}

function handleInfoRequest(event: IpcMainInvokeEvent) {
    const requestModal = findModalByCaller(event);
    if (requestModal) {
        return requestModal.handleInfoRequest();
    }
    return null;
}

export function showModal() {
    const withDevTools = process.env.MM_DEBUG_MODALS || false;
    modalQueue.forEach((modal, index) => {
        if (index === 0) {
            WindowManager.sendToRenderer(MODAL_OPEN);
            modal.show(undefined, Boolean(withDevTools));
        } else {
            WindowManager.sendToRenderer(MODAL_CLOSE);
            modal.hide();
        }
    });
}

function handleModalResult(event: IpcMainEvent, data: unknown) {
    const requestModal = findModalByCaller(event);
    if (requestModal) {
        requestModal.resolve(data);
    }
    filterActive();
    if (modalQueue.length) {
        showModal();
    } else {
        WindowManager.sendToRenderer(MODAL_CLOSE);
        WindowManager.focusBrowserView();
    }
}

function handleModalCancel(event: IpcMainEvent, data: unknown) {
    const requestModal = findModalByCaller(event);
    if (requestModal) {
        requestModal.reject(data);
    }
    filterActive();
    if (modalQueue.length) {
        showModal();
    } else {
        WindowManager.sendToRenderer(MODAL_CLOSE);
        WindowManager.focusBrowserView();
    }
}

function filterActive() {
    modalQueue = modalQueue.filter((modal) => modal.isActive());
}

export function isModalDisplayed() {
    return modalQueue.some((modal) => modal.isActive());
}

export function focusCurrentModal() {
    if (isModalDisplayed()) {
        modalQueue[0].view.webContents.focus();
    }
}

ipcMain.on(EMIT_CONFIGURATION, (event: IpcMainEvent, config: CombinedConfig) => {
    modalQueue.forEach((modal) => {
        modal.view.webContents.send(DARK_MODE_CHANGE, config.darkMode);
    });
});
