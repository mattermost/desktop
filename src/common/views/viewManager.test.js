// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {
    VIEW_CREATED,
    VIEW_TITLE_UPDATED,
    VIEW_PRIMARY_UPDATED,
    VIEW_REMOVED,
    SERVER_ADDED,
    SERVER_REMOVED,
} from 'common/communication';
import ServerManager from 'common/servers/serverManager';
import {ViewType} from 'common/views/MattermostView';

import {ViewManager} from './viewManager';

jest.mock('common/servers/serverManager', () => {
    const EventEmitter = jest.requireActual('events');
    const mockServerManager = new EventEmitter();

    return {
        on: jest.fn((event, handler) => mockServerManager.on(event, handler)),
        emit: jest.fn((event, ...args) => mockServerManager.emit(event, ...args)),
        getServer: jest.fn(),
        mockServerManager,
    };
});

jest.mock('common/config', () => ({
    viewLimit: 15,
}));
jest.mock('common/appState', () => ({
    switch: jest.fn(),
}));

describe('ViewManager', () => {
    const mockServer = {
        id: 'test-server-id',
        name: 'Test Server',
        url: new URL('https://test.com'),
        initialLoadURL: new URL('https://test.com'),
    };

    beforeAll(() => {
        ServerManager.getServer.mockReturnValue(mockServer);
    });

    describe('getPrimaryView', () => {
        const viewManager = new ViewManager();
        it('should return primary view for server', () => {
            const view = viewManager.createView(mockServer, ViewType.TAB);
            const view2 = viewManager.createView(mockServer, ViewType.TAB);
            const result = viewManager.getPrimaryView(mockServer.id);
            expect(result).toBe(view);
            viewManager.setPrimaryView(view2.id);
            const result2 = viewManager.getPrimaryView(mockServer.id);
            expect(result2).toBe(view2);
        });
    });

    describe('isPrimaryView', () => {
        let viewManager;
        beforeEach(() => {
            viewManager = new ViewManager();
        });

        it('should return false for non-existent view', () => {
            const result = viewManager.isPrimaryView('non-existent-id');
            expect(result).toBe(false);
        });

        it('should return false for non-primary view', () => {
            viewManager.createView(mockServer, ViewType.TAB);
            const view2 = viewManager.createView(mockServer, ViewType.TAB);
            const result = viewManager.isPrimaryView(view2.id);
            expect(result).toBe(false);
        });

        it('should return true for primary view', () => {
            const view = viewManager.createView(mockServer, ViewType.TAB);
            const result = viewManager.isPrimaryView(view.id);
            expect(result).toBe(true);
        });
    });

    describe('createView', () => {
        const viewManager = new ViewManager();
        it('should create a new view', () => {
            const emitSpy = jest.spyOn(viewManager, 'emit');
            const view = viewManager.createView(mockServer, ViewType.TAB);

            expect(view).toBeDefined();
            expect(view.serverId).toBe(mockServer.id);
            expect(view.type).toBe(ViewType.TAB);
            expect(view.title).toStrictEqual({serverName: mockServer.name});
            expect(viewManager.views.get(view.id)).toBe(view);
            expect(emitSpy).toHaveBeenCalledWith(VIEW_CREATED, view.id);
        });

        it('should respect viewLimit when creating new views', () => {
            // Set up a ViewManager with a viewLimit of 2
            const viewManager = new ViewManager();
            const mockServer = {
                id: 'test-server-id',
                name: 'Test Server',
                url: 'http://test.com',
            };

            // Set the viewLimit for this test
            const Config = require('common/config');
            Config.viewLimit = 2;

            // Create up to the limit
            const view1 = viewManager.createView(mockServer, ViewType.TAB);
            const view2 = viewManager.createView(mockServer, ViewType.TAB);

            expect(view1).toBeDefined();
            expect(view2).toBeDefined();

            // Try to create a third view, which should fail due to the limit
            const view3 = viewManager.createView(mockServer, ViewType.TAB);

            expect(view3).toBeUndefined();
        });
    });

    describe('updateViewTitle', () => {
        const viewManager = new ViewManager();
        it('should update view title and emit event', () => {
            const view = viewManager.createView(mockServer, ViewType.TAB);
            const emitSpy = jest.spyOn(viewManager, 'emit');

            viewManager.updateViewTitle(view.id, 'New Title');

            expect(view.title).toEqual({serverName: mockServer.name, channelName: 'New Title'});
            expect(emitSpy).toHaveBeenCalledWith(VIEW_TITLE_UPDATED, view.id);
        });
    });

    describe('setPrimaryView', () => {
        let viewManager;
        beforeEach(() => {
            viewManager = new ViewManager();
        });

        it('should set view as primary and emit event', () => {
            const view1 = viewManager.createView(mockServer, ViewType.TAB);
            const view2 = viewManager.createView(mockServer, ViewType.TAB);
            const emitSpy = jest.spyOn(viewManager, 'emit');

            expect(viewManager.serverPrimaryViews.get(mockServer.id)).toBe(view1.id);
            viewManager.setPrimaryView(view2.id);
            expect(viewManager.serverPrimaryViews.get(mockServer.id)).toBe(view2.id);
            expect(emitSpy).toHaveBeenCalledWith(VIEW_PRIMARY_UPDATED, mockServer.id, view2.id);
        });

        it('should not set non-existent view as primary', () => {
            const emitSpy = jest.spyOn(viewManager, 'emit');

            viewManager.setPrimaryView('non-existent-id');

            expect(emitSpy).not.toHaveBeenCalled();
        });
    });

    describe('removeView', () => {
        let viewManager;
        beforeEach(() => {
            viewManager = new ViewManager();
        });

        it('should remove view and emit event', () => {
            const view = viewManager.createView(mockServer, ViewType.TAB);
            const emitSpy = jest.spyOn(viewManager, 'emit');

            viewManager.removeView(view.id);

            expect(viewManager.views.get(view.id)).toBeUndefined();
            expect(emitSpy).toHaveBeenCalledWith(VIEW_REMOVED, view.id, mockServer.id);
        });

        it('should set new primary view when removing primary view', () => {
            const view1 = viewManager.createView(mockServer, ViewType.TAB);
            const view2 = viewManager.createView(mockServer, ViewType.TAB);
            const setPrimaryViewSpy = jest.spyOn(viewManager, 'setPrimaryView');

            viewManager.removeView(view1.id);

            expect(setPrimaryViewSpy).toHaveBeenCalledWith(view2.id);
        });

        it('should not set new primary view when removing non-primary view', () => {
            const view2 = viewManager.createView(mockServer, ViewType.TAB);
            const setPrimaryViewSpy = jest.spyOn(viewManager, 'setPrimaryView');

            viewManager.removeView(view2.id);

            expect(setPrimaryViewSpy).not.toHaveBeenCalled();
        });

        it('should not remove non-existent view', () => {
            const emitSpy = jest.spyOn(viewManager, 'emit');

            viewManager.removeView('non-existent-id');

            expect(emitSpy).not.toHaveBeenCalled();
        });
    });

    describe('handleServerWasRemoved', () => {
        const viewManager = new ViewManager();
        it('should remove all views for the server', () => {
            const view1 = viewManager.createView(mockServer, ViewType.TAB);
            const view2 = viewManager.createView(mockServer, ViewType.TAB);
            const removeViewSpy = jest.spyOn(viewManager, 'removeView');

            ServerManager.mockServerManager.emit(SERVER_REMOVED, mockServer.id);

            expect(removeViewSpy).toHaveBeenCalledWith(view1.id);
            expect(removeViewSpy).toHaveBeenCalledWith(view2.id);
            expect(viewManager.views.size).toBe(0);
        });

        it('should not remove views for other servers', () => {
            const otherServer = {
                id: 'other-server-id',
                name: 'Other Server',
                url: new URL('https://other.com'),
                initialLoadURL: new URL('https://other.com'),
            };
            const view1 = viewManager.createView(mockServer, ViewType.TAB);
            const view2 = viewManager.createView(otherServer, ViewType.TAB);
            const removeViewSpy = jest.spyOn(viewManager, 'removeView');

            ServerManager.mockServerManager.emit(SERVER_REMOVED, mockServer.id);

            expect(removeViewSpy).toHaveBeenCalledWith(view1.id);
            expect(removeViewSpy).not.toHaveBeenCalledWith(view2.id);
            expect(viewManager.views.size).toBe(1);
        });
    });

    describe('handleServerWasAdded', () => {
        const viewManager = new ViewManager();
        it('should create initial tab view for new server', () => {
            const createViewSpy = jest.spyOn(viewManager, 'createView');

            ServerManager.mockServerManager.emit(SERVER_ADDED, mockServer.id, true);

            expect(createViewSpy).toHaveBeenCalledWith(mockServer, ViewType.TAB);
        });
    });
});
