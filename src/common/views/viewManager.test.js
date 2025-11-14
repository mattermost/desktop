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

            ServerManager.mockServerManager.emit(SERVER_REMOVED, mockServer);

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

            ServerManager.mockServerManager.emit(SERVER_REMOVED, mockServer);

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

    describe('getViewTitle', () => {
        let viewManager;
        let otherServer;

        beforeEach(() => {
            viewManager = new ViewManager();
            otherServer = {
                id: 'other-server-id',
                name: 'Other Server',
                url: new URL('https://other.com'),
                initialLoadURL: new URL('https://other.com'),
            };
        });

        it('should return empty string for non-existent view', () => {
            const result = viewManager.getViewTitle('non-existent-id');
            expect(result).toBe('');
        });

        it('should use titleTemplate when available', () => {
            const view = viewManager.createView(mockServer, ViewType.TAB);
            view.props = {
                titleTemplate: '{channelName} - {teamName} - {serverName}',
            };
            viewManager.updateViewTitle(view.id, 'Test Channel', 'Test Team');

            const result = viewManager.getViewTitle(view.id);
            expect(result).toBe('Test Channel - Test Team - Test Server');
        });

        it('should handle titleTemplate with missing values', () => {
            const view = viewManager.createView(mockServer, ViewType.TAB);
            view.props = {
                titleTemplate: '{channelName} - {teamName} - {serverName}',
            };

            // Only set channelName, leave teamName undefined
            viewManager.updateViewTitle(view.id, 'Test Channel');

            const result = viewManager.getViewTitle(view.id);
            expect(result).toBe('Test Channel -  - Test Server');
        });

        it('should return channelName when only channelName is set', () => {
            const view = viewManager.createView(mockServer, ViewType.TAB);
            viewManager.updateViewTitle(view.id, 'Test Channel');

            const result = viewManager.getViewTitle(view.id);
            expect(result).toBe('Test Channel');
        });

        it('should return teamName when only teamName is set', () => {
            const view = viewManager.createView(mockServer, ViewType.TAB);
            viewManager.updateViewTitle(view.id, undefined, 'Test Team');

            const result = viewManager.getViewTitle(view.id);
            expect(result).toBe('Test Team');
        });

        it('should return serverName when neither channelName nor teamName is set', () => {
            const view = viewManager.createView(mockServer, ViewType.TAB);

            const result = viewManager.getViewTitle(view.id);
            expect(result).toBe('Test Server');
        });

        it('should return channelName when channelName and teamName are set but no duplicates exist', () => {
            const view = viewManager.createView(mockServer, ViewType.TAB);
            viewManager.updateViewTitle(view.id, 'Test Channel', 'Test Team');

            const result = viewManager.getViewTitle(view.id);
            expect(result).toBe('Test Channel');
        });

        it('should return channelName - teamName when duplicate channelNames exist across views (intended behavior)', () => {
            const view1 = viewManager.createView(mockServer, ViewType.TAB);
            const view2 = viewManager.createView(otherServer, ViewType.TAB);

            viewManager.updateViewTitle(view1.id, 'Test Channel', 'Team A');
            viewManager.updateViewTitle(view2.id, 'Test Channel', 'Team B');

            const result1 = viewManager.getViewTitle(view1.id);
            const result2 = viewManager.getViewTitle(view2.id);
            expect(result1).toBe('Test Channel - Team A');
            expect(result2).toBe('Test Channel - Team B');
        });

        it('should not consider duplicate channelNames within the same view', () => {
            const view = viewManager.createView(mockServer, ViewType.TAB);
            viewManager.updateViewTitle(view.id, 'Test Channel', 'Test Team');

            const result = viewManager.getViewTitle(view.id);
            expect(result).toBe('Test Channel');
        });

        it('should prefix server name for window type views', () => {
            const view = viewManager.createView(mockServer, ViewType.WINDOW);
            viewManager.updateViewTitle(view.id, 'Test Channel', 'Test Team');

            const result = viewManager.getViewTitle(view.id);
            expect(result).toBe('Test Server - Test Channel');
        });

        it('should prefix server name for window type views with only teamName', () => {
            const view = viewManager.createView(mockServer, ViewType.WINDOW);
            viewManager.updateViewTitle(view.id, undefined, 'Test Team');

            const result = viewManager.getViewTitle(view.id);
            expect(result).toBe('Test Server - Test Team');
        });

        it('should prefix server name for window type views with only serverName', () => {
            const view = viewManager.createView(mockServer, ViewType.WINDOW);

            const result = viewManager.getViewTitle(view.id);
            expect(result).toBe('Test Server - Test Server');
        });

        it('should handle complex titleTemplate with all placeholders', () => {
            const view = viewManager.createView(mockServer, ViewType.TAB);
            view.props = {
                titleTemplate: '[{serverName}] {teamName} > {channelName}',
            };
            viewManager.updateViewTitle(view.id, 'General', 'Engineering');

            const result = viewManager.getViewTitle(view.id);
            expect(result).toBe('[Test Server] Engineering > General');
        });

        it('should handle titleTemplate with no placeholders', () => {
            const view = viewManager.createView(mockServer, ViewType.TAB);
            view.props = {
                titleTemplate: 'Static Title',
            };
            viewManager.updateViewTitle(view.id, 'Test Channel', 'Test Team');

            const result = viewManager.getViewTitle(view.id);
            expect(result).toBe('Static Title');
        });
    });
});
