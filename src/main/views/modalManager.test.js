// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import ViewManager from 'main/views/viewManager';

import {ModalManager} from './modalManager';

jest.mock('electron', () => ({
    app: {},
    ipcMain: {
        handle: jest.fn(),
        on: jest.fn(),
    },
}));

jest.mock('main/views/webContentEvents', () => ({
    addWebContentsEventListeners: jest.fn(),
}));

jest.mock('./modalView', () => ({
    ModalView: jest.fn(),
}));
jest.mock('main/views/viewManager', () => ({
    focusCurrentView: jest.fn(),
}));
jest.mock('main/windows/mainWindow', () => ({
    on: jest.fn(),
    sendToRenderer: jest.fn(),
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

    describe('showModal', () => {
        const oldEnv = process.env;
        const modalManager = new ModalManager();
        const modalView = {key: 'test', view: {webContents: {id: 1}}, show: jest.fn(), hide: jest.fn()};
        const modalView2 = {key: 'test2', view: {webContents: {id: 2}}, show: jest.fn(), hide: jest.fn()};
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

        it('should show first modal and hide second one', () => {
            modalManager.showModal();
            expect(modalView.show).toBeCalled();
            expect(modalView.hide).not.toBeCalled();
        });

        it('should include dev tools when env variable is enabled', () => {
            process.env.MM_DEBUG_MODALS = true;
            modalManager.showModal();
            expect(modalView.show).toBeCalledWith(undefined, true);
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
            expect(ViewManager.focusCurrentView).toBeCalled();
        });
    });
});
