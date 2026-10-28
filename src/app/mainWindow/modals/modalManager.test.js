// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import MainWindow from 'app/mainWindow/mainWindow';
import TabManager from 'app/tabs/tabManager';
import AppState from 'common/appState';
import {MODAL_CLOSE, MODAL_OPEN} from 'common/communication';
import ServerManager from 'common/servers/serverManager';
import NotificationManager from 'main/notifications';

import {ModalManager} from './modalManager';

jest.mock('electron', () => ({
    app: {},
    ipcMain: {
        handle: jest.fn(),
        on: jest.fn(),
    },
}));

jest.mock('app/views/webContentEvents', () => ({
    addWebContentsEventListeners: jest.fn(),
}));

jest.mock('app/tabs/tabManager', () => ({
    on: jest.fn(),
    focusCurrentTab: jest.fn(),
}));

jest.mock('app/views/webContentsManager', () => ({
    on: jest.fn(),
}));

jest.mock('./modalView', () => ({
    ModalView: jest.fn().mockImplementation((key, html, preload, data, resolve, reject, win, uncloseable, serverId) => ({key, serverId})),
}));
jest.mock('common/views/viewManager', () => ({
    focusCurrentView: jest.fn(),
}));
jest.mock('app/mainWindow/mainWindow', () => ({
    on: jest.fn(),
    sendToRenderer: jest.fn(),
    get: jest.fn(),
}));
jest.mock('common/servers/serverManager', () => ({
    on: jest.fn(),
    getCurrentServerId: jest.fn(),
}));
jest.mock('common/appState', () => ({
    updatePendingModal: jest.fn(),
}));
jest.mock('main/notifications', () => ({
    displayServerModal: jest.fn(),
}));
jest.mock('process', () => ({
    env: {},
}));

describe('main/views/modalManager', () => {
    describe('addModal', () => {
        const modalManager = new ModalManager();

        beforeEach(() => {
            modalManager.modalQueue = [];
            modalManager.modalPromises = new Map();
            modalManager.showModal = jest.fn();
        });

        it('should not add modal with the same key, should return the existing promise', () => {
            modalManager.modalQueue.push({key: 'existing_key'});
            const promise = Promise.resolve();
            modalManager.modalPromises.set('existing_key', promise);
            expect(modalManager.addModal('existing_key', 'some_html', 'preload', {}, {})).toBe(promise);
        });

        it('should add modal to queue and add the promise, but dont show', () => {
            modalManager.modalQueue.push({key: 'existing_key'});
            const promise = Promise.resolve();
            modalManager.modalPromises.set('existing_key', promise);
            modalManager.addModal('new_key', 'some_html', 'preload', {}, {});
            expect(modalManager.modalPromises.has('new_key')).toBe(true);
            expect(modalManager.modalQueue.length).toBe(2);
            expect(modalManager.showModal).not.toBeCalled();
        });

        it('should add modal to queue and add the promise, but dont show', () => {
            modalManager.addModal('new_key', 'some_html', 'preload', {}, {});
            expect(modalManager.modalPromises.has('new_key')).toBe(true);
            expect(modalManager.modalQueue.length).toBe(1);
            expect(modalManager.showModal).toBeCalled();
        });

        it('should not show a modal scoped to a server that is not current', () => {
            ServerManager.getCurrentServerId.mockReturnValue('server-1');
            modalManager.addModal('new_key', 'some_html', 'preload', {}, {}, false, 'server-2');
            expect(modalManager.modalQueue.length).toBe(1);
            expect(modalManager.showModal).not.toBeCalled();
        });

        it('should show a modal scoped to the current server', () => {
            ServerManager.getCurrentServerId.mockReturnValue('server-1');
            modalManager.addModal('new_key', 'some_html', 'preload', {}, {}, false, 'server-1');
            expect(modalManager.showModal).toBeCalled();
            expect(NotificationManager.displayServerModal).not.toBeCalled();
        });

        it('should mark the server as having a pending modal', () => {
            modalManager.addModal('new_key', 'some_html', 'preload', {}, {}, false, 'server-2');
            expect(AppState.updatePendingModal).toBeCalledWith('server-2', true);
        });

        it('should notify once when a server that is not current gets its first modal', () => {
            ServerManager.getCurrentServerId.mockReturnValue('server-1');
            modalManager.addModal('first_key', 'some_html', 'preload', {}, {}, false, 'server-2');
            modalManager.addModal('second_key', 'some_html', 'preload', {}, {}, false, 'server-2');
            expect(NotificationManager.displayServerModal).toHaveBeenCalledTimes(1);
            expect(NotificationManager.displayServerModal).toBeCalledWith('server-2');
        });

        it('should not notify for global modals', () => {
            modalManager.addModal('new_key', 'some_html', 'preload', {}, {});
            expect(NotificationManager.displayServerModal).not.toBeCalled();
            expect(AppState.updatePendingModal).not.toBeCalled();
        });
    });

    describe('findModalByCaller', () => {
        const modalManager = new ModalManager();
        const modalView = {key: 'test', view: {webContents: {id: 1}}};
        const promise = Promise.resolve();

        beforeEach(() => {
            modalManager.modalQueue = [modalView];
            modalManager.modalPromises = new Map([['test', promise]]);
        });

        it('should return modal by webContentsId', () => {
            expect(modalManager.findModalByCaller({sender: {id: 1}})).toBe(modalView);
        });
    });

    describe('addPriorityModal', () => {
        const modalManager = new ModalManager();

        beforeEach(() => {
            modalManager.modalQueue = [];
            modalManager.modalPromises = new Map();
            modalManager.showModal = jest.fn();
        });

        it('should not add modal with the same key, should return the existing promise', () => {
            modalManager.modalQueue.push({key: 'existing_key'});
            const promise = Promise.resolve();
            modalManager.modalPromises.set('existing_key', promise);
            expect(modalManager.addPriorityModal('existing_key', 'some_html', 'preload', {}, {})).toBe(promise);
        });

        it('should insert modal at front of queue and always call showModal', () => {
            const existingModal = {key: 'existing_key', suspend: jest.fn()};
            modalManager.modalQueue.push(existingModal);
            modalManager.addPriorityModal('priority_key', 'some_html', 'preload', {}, {});
            expect(modalManager.modalPromises.has('priority_key')).toBe(true);
            expect(modalManager.modalQueue.length).toBe(2);
            expect(modalManager.modalQueue[1]).toBe(existingModal);
            expect(modalManager.showModal).toBeCalled();
        });

        it('should not show a priority modal scoped to a server that is not current', () => {
            ServerManager.getCurrentServerId.mockReturnValue('server-1');
            modalManager.modalQueue.push({key: 'existing_key'});
            modalManager.addPriorityModal('priority_key', 'some_html', 'preload', {}, {}, false, 'server-2');
            expect(modalManager.modalQueue[0].key).toBe('priority_key');
            expect(modalManager.showModal).not.toBeCalled();
        });

        it('should work when queue is empty', () => {
            modalManager.addPriorityModal('new_key', 'some_html', 'preload', {}, {});
            expect(modalManager.modalPromises.has('new_key')).toBe(true);
            expect(modalManager.modalQueue.length).toBe(1);
            expect(modalManager.showModal).toBeCalled();
        });
    });

    describe('showModal', () => {
        const oldEnv = process.env;
        const modalManager = new ModalManager();
        const modalView = {key: 'test', view: {webContents: {id: 1}}, show: jest.fn(), suspend: jest.fn()};
        const modalView2 = {key: 'test2', view: {webContents: {id: 2}}, show: jest.fn(), suspend: jest.fn()};
        const promise = Promise.resolve();

        beforeEach(() => {
            jest.resetModules();
            modalManager.modalQueue = [modalView, modalView2];
            modalManager.modalPromises = new Map([['test', promise], ['test2', promise]]);
            process.env = {...oldEnv};
        });

        afterEach(() => {
            process.env = oldEnv;
        });

        it('should show first modal and suspend second one', () => {
            modalManager.showModal();
            expect(modalView.show).toBeCalled();
            expect(modalView2.suspend).toBeCalled();
        });

        it('should include dev tools when env variable is enabled', () => {
            process.env.MM_DEBUG_MODALS = true;
            modalManager.showModal();
            expect(modalView.show).toBeCalledWith(undefined, true);
        });

        it('should show the first modal for the current server and suspend the others', () => {
            ServerManager.getCurrentServerId.mockReturnValue('server-2');
            const otherServerModal = {key: 'other', serverId: 'server-1', view: {webContents: {id: 3}}, show: jest.fn(), suspend: jest.fn()};
            const currentServerModal = {key: 'current', serverId: 'server-2', view: {webContents: {id: 4}}, show: jest.fn(), suspend: jest.fn()};
            modalManager.modalQueue = [otherServerModal, currentServerModal];
            modalManager.showModal();
            expect(otherServerModal.suspend).toBeCalled();
            expect(currentServerModal.show).toBeCalled();
            expect(MainWindow.sendToRenderer).toBeCalledWith(MODAL_OPEN, true);
        });

        it('should tell the renderer when a global modal is shown', () => {
            modalManager.showModal();
            expect(MainWindow.sendToRenderer).toBeCalledWith(MODAL_OPEN, false);
        });

        it('should emit whether the shown modal is server-scoped', () => {
            ServerManager.getCurrentServerId.mockReturnValue('server-2');
            const currentServerModal = {key: 'current', serverId: 'server-2', view: {webContents: {id: 4}}, show: jest.fn(), suspend: jest.fn()};
            modalManager.modalQueue = [currentServerModal];
            const listener = jest.fn();
            modalManager.on(MODAL_OPEN, listener);
            modalManager.showModal();
            modalManager.off(MODAL_OPEN, listener);
            expect(listener).toBeCalledWith(true);
        });

        it('should close the modal state when no modal belongs to the current server', () => {
            ServerManager.getCurrentServerId.mockReturnValue('server-2');
            const otherServerModal = {key: 'other', serverId: 'server-1', view: {webContents: {id: 3}}, show: jest.fn(), suspend: jest.fn()};
            modalManager.modalQueue = [otherServerModal];
            modalManager.showModal();
            expect(otherServerModal.suspend).toBeCalled();
            expect(otherServerModal.show).not.toBeCalled();
            expect(MainWindow.sendToRenderer).toBeCalledWith(MODAL_CLOSE);
            expect(modalManager.isModalDisplayed()).toBe(false);
        });
    });

    describe('handleServerRemoved', () => {
        const modalManager = new ModalManager();

        it('should reject and remove modals scoped to the removed server', () => {
            const removedServerModal = {key: 'removed', serverId: 'server-1', reject: jest.fn(), isActive: jest.fn(() => false)};
            const otherModal = {key: 'other', serverId: 'server-2', reject: jest.fn(), isActive: jest.fn(() => true), suspend: jest.fn()};
            modalManager.modalQueue = [removedServerModal, otherModal];
            modalManager.modalPromises = new Map([['removed', Promise.resolve()], ['other', Promise.resolve()]]);
            ServerManager.getCurrentServerId.mockReturnValue('server-3');

            modalManager.handleServerRemoved({id: 'server-1'});

            expect(removedServerModal.reject).toBeCalledWith(undefined);
            expect(otherModal.reject).not.toBeCalled();
            expect(modalManager.modalQueue).toEqual([otherModal]);
            expect(modalManager.modalPromises.has('removed')).toBe(false);
            expect(modalManager.modalPromises.has('other')).toBe(true);
        });
    });

    describe('handleModalFinished', () => {
        const modalManager = new ModalManager();
        const modalView = {key: 'test', view: {webContents: {id: 1}}, resolve: jest.fn(), reject: jest.fn()};
        const modalView2 = {key: 'test2', view: {webContents: {id: 2}}, resolve: jest.fn(), reject: jest.fn()};
        const promise = Promise.resolve();

        beforeEach(() => {
            modalManager.modalQueue = [modalView, modalView2];
            modalManager.modalPromises = new Map([['test', promise], ['test2', promise]]);
            modalManager.showModal = jest.fn();
            modalManager.filterActive = () => {
                modalManager.modalQueue.pop();
            };
            modalManager.findModalByCaller = (event) => {
                switch (event.sender.id) {
                case 1:
                    return modalView;
                case 2:
                    return modalView2;
                }
                return null;
            };
        });

        it('should handle results for specified modal and go to next modal', () => {
            modalManager.handleModalFinished('resolve', {sender: {id: 1}}, 'something');
            expect(modalView.resolve).toBeCalledWith('something');
            expect(modalView.reject).not.toBeCalled();
            expect(modalManager.modalPromises.has('test')).toBe(false);
            expect(modalManager.modalQueue.length).toBe(1);
            expect(modalManager.showModal).toBeCalled();
        });

        it('should handle cancel for specified modal and go to next modal', () => {
            modalManager.handleModalFinished('reject', {sender: {id: 1}}, 'something');
            expect(modalView.reject).toBeCalledWith('something');
            expect(modalView.resolve).not.toBeCalled();
            expect(modalManager.modalPromises.has('test')).toBe(false);
            expect(modalManager.modalQueue.length).toBe(1);
            expect(modalManager.showModal).toBeCalled();
        });

        it('should focus main browser view when all modals are gone', () => {
            modalManager.modalQueue.pop();
            modalManager.modalPromises.delete('test2');
            modalManager.handleModalFinished('resolve', {sender: {id: 1}}, 'something');
            expect(TabManager.focusCurrentTab).toBeCalled();
        });

        it('should clear the pending modal state when the last modal for a server finishes', () => {
            const serverModal = {key: 'server', serverId: 'server-1', view: {webContents: {id: 3}}, resolve: jest.fn(), reject: jest.fn()};
            modalManager.modalQueue = [serverModal];
            modalManager.findModalByCaller = () => serverModal;
            modalManager.handleModalFinished('resolve', {sender: {id: 3}}, 'something');
            expect(AppState.updatePendingModal).toBeCalledWith('server-1', false);
        });
    });

    describe('focusCurrentModal', () => {
        const modalManager = new ModalManager();
        const mockWebContents = {focus: jest.fn()};
        const mockMainWindow = {isFocused: jest.fn()};
        const modalView = {
            key: 'test',
            view: {webContents: mockWebContents},
            isActive: jest.fn(() => true),
        };

        beforeEach(() => {
            jest.clearAllMocks();
            modalManager.modalQueue = [];
            MainWindow.get.mockReturnValue(mockMainWindow);
        });

        it('should focus modal webContents when main window is focused and modal is displayed', () => {
            modalManager.modalQueue = [modalView];
            mockMainWindow.isFocused.mockReturnValue(true);

            modalManager.focusCurrentModal();

            expect(mockWebContents.focus).toBeCalled();
        });

        it('should not focus modal webContents when main window is not focused', () => {
            modalManager.modalQueue = [modalView];
            mockMainWindow.isFocused.mockReturnValue(false);

            modalManager.focusCurrentModal();

            expect(mockWebContents.focus).not.toBeCalled();
        });
    });
});
