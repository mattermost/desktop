// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import ServerManager from 'common/servers/serverManager';
import {getDefaultViewsForConfigServer} from 'common/views/View';

import ModalManager from 'main/views/modalManager';
import {getLocalURLString, getLocalPreload} from 'main/utils';
import MainWindow from 'main/windows/mainWindow';
import ViewManager from 'main/views/viewManager';

import * as Servers from './servers';

jest.mock('electron', () => ({
    ipcMain: {
        emit: jest.fn(),
    },
}));

jest.mock('common/servers/serverManager', () => ({
    setViewIsOpen: jest.fn(),
    getAllServers: jest.fn(),
    hasServers: jest.fn(),
    addServer: jest.fn(),
    editServer: jest.fn(),
    removeServer: jest.fn(),
    getServer: jest.fn(),
    getView: jest.fn(),
    getLastActiveTabForServer: jest.fn(),
    getServerLog: jest.fn(),
}));
jest.mock('common/views/View', () => ({
    getDefaultViewsForConfigServer: jest.fn(),
}));
jest.mock('main/views/modalManager', () => ({
    addModal: jest.fn(),
}));
jest.mock('main/utils', () => ({
    getLocalPreload: jest.fn(),
    getLocalURLString: jest.fn(),
}));
jest.mock('main/windows/mainWindow', () => ({
    get: jest.fn(),
    show: jest.fn(),
}));
jest.mock('main/views/viewManager', () => ({
    getView: jest.fn(),
    showById: jest.fn(),
}));

const tabs = [
    {
        name: 'view-1',
        order: 0,
        isOpen: false,
    },
    {
        name: 'view-2',
        order: 2,
        isOpen: true,
    },
    {
        name: 'view-3',
        order: 1,
        isOpen: true,
    },
];
const servers = [
    {
        id: 'server-1',
        name: 'server-1',
        url: 'http://server-1.com',
        tabs,
    },
];

describe('main/app/servers', () => {
    describe('switchServer', () => {
        const views = new Map([
            ['view-1', {id: 'view-1'}],
            ['view-2', {id: 'view-2'}],
            ['view-3', {id: 'view-3'}],
        ]);

        beforeEach(() => {
            jest.useFakeTimers();
            const server1 = {
                id: 'server-1',
            };
            const server2 = {
                id: 'server-2',
            };
            ServerManager.getServer.mockImplementation((name) => {
                switch (name) {
                case 'server-1':
                    return server1;
                case 'server-2':
                    return server2;
                default:
                    return undefined;
                }
            });
            ServerManager.getServerLog.mockReturnValue({debug: jest.fn(), error: jest.fn()});
            ViewManager.getView.mockImplementation((viewId) => views.get(viewId));
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        afterAll(() => {
            jest.runOnlyPendingTimers();
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        it('should do nothing if cannot find the server', () => {
            Servers.switchServer('server-3');
            expect(ViewManager.showById).not.toBeCalled();
        });

        it('should show first open view in order when last active not defined', () => {
            ServerManager.getLastActiveTabForServer.mockReturnValue({id: 'view-3'});
            Servers.switchServer('server-1');
            expect(ViewManager.showById).toHaveBeenCalledWith('view-3');
        });

        it('should show last active view of chosen server', () => {
            ServerManager.getLastActiveTabForServer.mockReturnValue({id: 'view-2'});
            Servers.switchServer('server-2');
            expect(ViewManager.showById).toHaveBeenCalledWith('view-2');
        });

        it('should wait for view to exist if specified', () => {
            ServerManager.getLastActiveTabForServer.mockReturnValue({id: 'view-3'});
            views.delete('view-3');
            Servers.switchServer('server-1', true);
            expect(ViewManager.showById).not.toBeCalled();

            jest.advanceTimersByTime(200);
            expect(ViewManager.showById).not.toBeCalled();

            views.set('view-3', {});
            jest.advanceTimersByTime(200);
            expect(ViewManager.showById).toBeCalledWith('view-3');
        });
    });

    describe('handleNewServerModal', () => {
        let serversCopy;

        beforeEach(() => {
            getLocalURLString.mockReturnValue('/some/index.html');
            getLocalPreload.mockReturnValue('/some/preload.js');
            MainWindow.get.mockReturnValue({});

            serversCopy = JSON.parse(JSON.stringify(servers));
            ServerManager.getAllServers.mockReturnValue([]);
            ServerManager.addServer.mockImplementation(() => {
                const newServer = {
                    id: 'server-1',
                    name: 'new-server',
                    url: 'http://new-server.com',
                    tabs,
                };
                serversCopy = [
                    ...serversCopy,
                    newServer,
                ];
                return newServer;
            });
            ServerManager.hasServers.mockReturnValue(Boolean(serversCopy.length));
            ServerManager.getServerLog.mockReturnValue({debug: jest.fn(), error: jest.fn()});

            getDefaultViewsForConfigServer.mockImplementation((server) => ({
                ...server,
                tabs,
            }));
        });

        it('should add new server to the config', async () => {
            const data = {
                name: 'new-server',
                url: 'http://new-server.com',
            };
            const promise = Promise.resolve(data);
            ModalManager.addModal.mockReturnValue(promise);

            Servers.handleNewServerModal();
            await promise;

            expect(ServerManager.addServer).toHaveBeenCalledWith(data);
            expect(serversCopy).toContainEqual(expect.objectContaining({
                id: 'server-1',
                name: 'new-server',
                url: 'http://new-server.com',
                tabs,
            }));

            // TODO: For some reason jest won't recognize this as being called
            //expect(spy).toHaveBeenCalledWith('server-1', true);
        });
    });

    describe('handleEditServerModal', () => {
        let serversCopy;

        beforeEach(() => {
            getLocalURLString.mockReturnValue('/some/index.html');
            getLocalPreload.mockReturnValue('/some/preload.js');
            MainWindow.get.mockReturnValue({});

            serversCopy = JSON.parse(JSON.stringify(servers));
            ServerManager.getServer.mockImplementation((id) => {
                if (id !== serversCopy[0].id) {
                    return undefined;
                }
                return {...serversCopy[0], toUniqueServer: jest.fn()};
            });
            ServerManager.editServer.mockImplementation((id, server) => {
                if (id !== serversCopy[0].id) {
                    return;
                }
                const newServer = {
                    ...serversCopy[0],
                    ...server,
                };
                serversCopy = [newServer];
            });
            ServerManager.getAllServers.mockReturnValue(serversCopy.map((server) => ({...server, toUniqueServer: jest.fn()})));
        });

        it('should do nothing when the server cannot be found', () => {
            Servers.handleEditServerModal(null, 'bad-server');
            expect(ModalManager.addModal).not.toBeCalled();
        });

        it('should edit the existing server', async () => {
            const promise = Promise.resolve({
                name: 'new-server',
                url: 'http://new-server.com',
            });
            ModalManager.addModal.mockReturnValue(promise);

            Servers.handleEditServerModal(null, 'server-1');
            await promise;
            expect(serversCopy).not.toContainEqual(expect.objectContaining({
                id: 'server-1',
                name: 'server-1',
                url: 'http://server-1.com',
                tabs,
            }));
            expect(serversCopy).toContainEqual(expect.objectContaining({
                id: 'server-1',
                name: 'new-server',
                url: 'http://new-server.com',
                tabs,
            }));
        });
    });

    describe('handleRemoveServerModal', () => {
        let serversCopy;

        beforeEach(() => {
            getLocalURLString.mockReturnValue('/some/index.html');
            getLocalPreload.mockReturnValue('/some/preload.js');
            MainWindow.get.mockReturnValue({});

            serversCopy = JSON.parse(JSON.stringify(servers));
            ServerManager.getServer.mockImplementation((id) => {
                if (id !== serversCopy[0].id) {
                    return undefined;
                }
                return serversCopy[0];
            });
            ServerManager.removeServer.mockImplementation(() => {
                serversCopy = [];
            });
            ServerManager.getAllServers.mockReturnValue(serversCopy);
        });

        it('should remove the existing server', async () => {
            const promise = Promise.resolve(true);
            ModalManager.addModal.mockReturnValue(promise);

            Servers.handleRemoveServerModal(null, 'server-1');
            await promise;
            expect(serversCopy).not.toContainEqual(expect.objectContaining({
                id: 'server-1',
                name: 'server-1',
                url: 'http://server-1.com',
                tabs,
            }));
        });

        it('should not remove the existing server when clicking Cancel', async () => {
            const promise = Promise.resolve(false);
            ModalManager.addModal.mockReturnValue(promise);

            expect(serversCopy).toContainEqual(expect.objectContaining({
                id: 'server-1',
                name: 'server-1',
                url: 'http://server-1.com',
                tabs,
            }));

            Servers.handleRemoveServerModal(null, 'server-1');
            await promise;
            expect(serversCopy).toContainEqual(expect.objectContaining({
                id: 'server-1',
                name: 'server-1',
                url: 'http://server-1.com',
                tabs,
            }));
        });
    });
});
