// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';
import {URLValidationStatus} from 'common/utils/constants';
import {getDefaultViewsForConfigServer} from 'common/views/View';
import PermissionsManager from 'main/permissionsManager';
import {ServerInfo} from 'main/server/serverInfo';
import {getLocalPreload} from 'main/utils';
import ModalManager from 'main/views/modalManager';
import ViewManager from 'main/views/viewManager';
import MainWindow from 'main/windows/mainWindow';

import {ServerViewState} from './serverViewState';

jest.mock('electron', () => ({
    app: {
        getPath: jest.fn(() => '/valid/downloads/path'),
    },
    ipcMain: {
        on: jest.fn(),
        handle: jest.fn(),
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
    lookupViewByURL: jest.fn(),
    getOrderedServers: jest.fn(),
}));
jest.mock('common/servers/MattermostServer', () => ({
    MattermostServer: jest.fn(),
}));
jest.mock('common/views/View', () => ({
    getDefaultViewsForConfigServer: jest.fn(),
}));
jest.mock('main/server/serverInfo', () => ({
    ServerInfo: jest.fn(),
}));
jest.mock('main/views/modalManager', () => ({
    addModal: jest.fn(),
}));
jest.mock('main/utils', () => ({
    getLocalPreload: jest.fn(),
}));
jest.mock('main/windows/mainWindow', () => ({
    get: jest.fn(),
    show: jest.fn(),
}));
jest.mock('main/views/viewManager', () => ({
    getView: jest.fn(),
    showById: jest.fn(),
}));
jest.mock('main/permissionsManager', () => ({
    getForServer: jest.fn(),
    setForServer: jest.fn(),
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

describe('app/serverViewState', () => {
    describe('switchServer', () => {
        const serverViewState = new ServerViewState();
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
            serverViewState.switchServer('server-3');
            expect(ViewManager.showById).not.toBeCalled();
        });

        it('should show first open view in order when last active not defined', () => {
            ServerManager.getLastActiveTabForServer.mockReturnValue({id: 'view-3'});
            serverViewState.switchServer('server-1');
            expect(ViewManager.showById).toHaveBeenCalledWith('view-3');
        });

        it('should show last active view of chosen server', () => {
            ServerManager.getLastActiveTabForServer.mockReturnValue({id: 'view-2'});
            serverViewState.switchServer('server-2');
            expect(ViewManager.showById).toHaveBeenCalledWith('view-2');
        });

        it('should wait for view to exist if specified', () => {
            ServerManager.getLastActiveTabForServer.mockReturnValue({id: 'view-3'});
            views.delete('view-3');
            serverViewState.switchServer('server-1', true);
            expect(ViewManager.showById).not.toBeCalled();

            jest.advanceTimersByTime(200);
            expect(ViewManager.showById).not.toBeCalled();

            views.set('view-3', {});
            jest.advanceTimersByTime(200);
            expect(ViewManager.showById).toBeCalledWith('view-3');
        });
    });

    describe('showNewServerModal', () => {
        const serverViewState = new ServerViewState();
        let serversCopy;

        beforeEach(() => {
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

            serverViewState.showNewServerModal();
            await promise;

            expect(ServerManager.addServer).toHaveBeenCalledWith(data, undefined);
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
        const serverViewState = new ServerViewState();
        let serversCopy;

        beforeEach(() => {
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
            PermissionsManager.getForServer.mockReturnValue({notifications: {allowed: true}});
        });

        it('should do nothing when the server cannot be found', () => {
            serverViewState.showEditServerModal(null, 'bad-server');
            expect(ModalManager.addModal).not.toBeCalled();
        });

        it('should edit the existing server', async () => {
            const promise = Promise.resolve({server: {
                name: 'new-server',
                url: 'http://new-server.com',
            }});
            ModalManager.addModal.mockReturnValue(promise);

            serverViewState.showEditServerModal(null, 'server-1');
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

        it('should edit the permissions', async () => {
            const promise = Promise.resolve({server: {
                name: 'server-1',
                url: 'http://server-1.com',
            },
            permissions: {
                notifications: {
                    alwaysDeny: true,
                },
            }});
            ModalManager.addModal.mockReturnValue(promise);

            serverViewState.showEditServerModal(null, 'server-1');
            await promise;
            expect(PermissionsManager.setForServer).toHaveBeenCalledWith(expect.objectContaining({
                id: 'server-1',
                name: 'server-1',
                url: 'http://server-1.com',
                tabs,
            }), {
                notifications: {
                    alwaysDeny: true,
                },
            });
        });
    });

    describe('handleRemoveServerModal', () => {
        const serverViewState = new ServerViewState();
        let serversCopy;

        beforeEach(() => {
            getLocalPreload.mockReturnValue('/some/preload.js');
            MainWindow.get.mockReturnValue({});

            serversCopy = JSON.parse(JSON.stringify(servers));
            ServerManager.getServer.mockImplementation(() => {
                return serversCopy[0];
            });
            ServerManager.removeServer.mockImplementation(() => {
                serversCopy = [];
            });
            ServerManager.getOrderedServers.mockReturnValue(serversCopy);
        });

        it('should remove the existing server', async () => {
            const promise = Promise.resolve(true);
            ModalManager.addModal.mockReturnValue(promise);

            serverViewState.showRemoveServerModal(null, 'server-1');
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

            serverViewState.showRemoveServerModal(null, 'server-1');
            await promise;
            expect(serversCopy).toContainEqual(expect.objectContaining({
                id: 'server-1',
                name: 'server-1',
                url: 'http://server-1.com',
                tabs,
            }));
        });
    });

    describe('handleServerURLValidation', () => {
        const serverViewState = new ServerViewState();

        beforeEach(() => {
            MattermostServer.mockImplementation(({url}) => ({url}));
            ServerInfo.mockImplementation(({url}) => ({
                fetchConfigData: jest.fn().mockImplementation(() => ({
                    serverVersion: '7.8.0',
                    siteName: 'Mattermost',
                    siteURL: url,
                })),
            }));
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should return Missing when you get no URL', async () => {
            const result = await serverViewState.handleServerURLValidation({});
            expect(result.status).toBe(URLValidationStatus.Missing);
        });

        it('should return Invalid when you pass in invalid characters', async () => {
            const result = await serverViewState.handleServerURLValidation({}, '!@#$%^&*()!@#$%^&*()');
            expect(result.status).toBe(URLValidationStatus.Invalid);
        });

        it('should include HTTPS when missing', async () => {
            const result = await serverViewState.handleServerURLValidation({}, 'server.com');
            expect(result.status).toBe(URLValidationStatus.OK);
            expect(result.validatedURL).toBe('https://server.com/');
        });

        it('should correct typos in the protocol', async () => {
            const result = await serverViewState.handleServerURLValidation({}, 'htpst://server.com');
            expect(result.status).toBe(URLValidationStatus.OK);
            expect(result.validatedURL).toBe('https://server.com/');
        });

        it('should replace HTTP with HTTPS when applicable', async () => {
            const result = await serverViewState.handleServerURLValidation({}, 'http://server.com');
            expect(result.status).toBe(URLValidationStatus.OK);
            expect(result.validatedURL).toBe('https://server.com/');
        });

        it('should generate a warning when the server already exists', async () => {
            ServerManager.lookupViewByURL.mockReturnValue({server: {id: 'server-1', url: new URL('https://server.com')}});
            const result = await serverViewState.handleServerURLValidation({}, 'https://server.com');
            expect(result.status).toBe(URLValidationStatus.URLExists);
            expect(result.validatedURL).toBe('https://server.com/');
        });

        it('should generate a warning if the server exists when editing', async () => {
            ServerManager.lookupViewByURL.mockReturnValue({server: {name: 'Server 1', id: 'server-1', url: new URL('https://server.com')}});
            const result = await serverViewState.handleServerURLValidation({}, 'https://server.com', 'server-2');
            expect(result.status).toBe(URLValidationStatus.URLExists);
            expect(result.validatedURL).toBe('https://server.com/');
            expect(result.existingServerName).toBe('Server 1');
        });

        it('should not generate a warning if editing the same server', async () => {
            ServerManager.lookupViewByURL.mockReturnValue({server: {name: 'Server 1', id: 'server-1', url: new URL('https://server.com')}});
            const result = await serverViewState.handleServerURLValidation({}, 'https://server.com', 'server-1');
            expect(result.status).toBe(URLValidationStatus.OK);
            expect(result.validatedURL).toBe('https://server.com/');
        });

        it('should not update the URL if the user is typing https://', async () => {
            let result = await serverViewState.handleServerURLValidation({}, 'h');
            expect(result.status).toBe(URLValidationStatus.Invalid);
            result = await serverViewState.handleServerURLValidation({}, 'ht');
            expect(result.status).toBe(URLValidationStatus.Invalid);
            result = await serverViewState.handleServerURLValidation({}, 'htt');
            expect(result.status).toBe(URLValidationStatus.Invalid);
            result = await serverViewState.handleServerURLValidation({}, 'http');
            expect(result.status).toBe(URLValidationStatus.Invalid);
            result = await serverViewState.handleServerURLValidation({}, 'HTTP');
            expect(result.status).toBe(URLValidationStatus.Invalid);
            result = await serverViewState.handleServerURLValidation({}, 'https');
            expect(result.status).toBe(URLValidationStatus.Invalid);
            result = await serverViewState.handleServerURLValidation({}, 'HTTPS');
            expect(result.status).toBe(URLValidationStatus.Invalid);
            result = await serverViewState.handleServerURLValidation({}, 'https:');
            expect(result.status).toBe(URLValidationStatus.Invalid);
            result = await serverViewState.handleServerURLValidation({}, 'https:/');
            expect(result.status).toBe(URLValidationStatus.Invalid);
            result = await serverViewState.handleServerURLValidation({}, 'https://');
            expect(result.status).toBe(URLValidationStatus.Invalid);
            result = await serverViewState.handleServerURLValidation({}, 'https://a');
            expect(result.status).toBe(URLValidationStatus.OK);
        });

        it('should update the URL if the user is typing something other than http', async () => {
            let result = await serverViewState.handleServerURLValidation({}, 'abchttp');
            expect(result.status).toBe(URLValidationStatus.OK);
            result = await serverViewState.handleServerURLValidation({}, 'abchttps');
            expect(result.status).toBe(URLValidationStatus.OK);
        });

        it('should attempt HTTP when HTTPS fails, and generate a warning', async () => {
            ServerInfo.mockImplementation(({url}) => ({
                fetchConfigData: jest.fn().mockImplementation(() => {
                    if (url.startsWith('https:')) {
                        return undefined;
                    }

                    return {
                        serverVersion: '7.8.0',
                        siteName: 'Mattermost',
                        siteURL: url,
                    };
                }),
            }));

            const result = await serverViewState.handleServerURLValidation({}, 'http://server.com');
            expect(result.status).toBe(URLValidationStatus.Insecure);
            expect(result.validatedURL).toBe('http://server.com/');
        });

        it('should be able to recognize localhost with a port and add the appropriate prefix', async () => {
            ServerInfo.mockImplementation(({url}) => ({
                fetchConfigData: jest.fn().mockImplementation(() => {
                    if (url.startsWith('https:')) {
                        return undefined;
                    }

                    return {
                        serverVersion: '7.8.0',
                        siteName: 'Mattermost',
                        siteURL: url,
                    };
                }),
            }));

            const result = await serverViewState.handleServerURLValidation({}, 'localhost:8065');
            expect(result.status).toBe(URLValidationStatus.Insecure);
            expect(result.validatedURL).toBe('http://localhost:8065/');
        });

        it('should show a warning when the ping request times out', async () => {
            ServerInfo.mockImplementation(() => ({
                fetchConfigData: jest.fn().mockImplementation(() => {
                    throw new Error();
                }),
            }));

            const result = await serverViewState.handleServerURLValidation({}, 'https://not-server.com');
            expect(result.status).toBe(URLValidationStatus.NotMattermost);
            expect(result.validatedURL).toBe('https://not-server.com');
        });

        it('should update the users URL when the Site URL is different', async () => {
            ServerInfo.mockImplementation(() => ({
                fetchConfigData: jest.fn().mockImplementation(() => {
                    return {
                        serverVersion: '7.8.0',
                        siteName: 'Mattermost',
                        siteURL: 'https://mainserver.com/',
                    };
                }),
            }));

            const result = await serverViewState.handleServerURLValidation({}, 'https://server.com');
            expect(result.status).toBe(URLValidationStatus.URLUpdated);
            expect(result.validatedURL).toBe('https://mainserver.com/');
        });

        it('should not update the users URL when the Site URL is blank', async () => {
            ServerInfo.mockImplementation(() => ({
                fetchConfigData: jest.fn().mockImplementation(() => {
                    return {
                        serverVersion: '7.8.0',
                        siteName: 'Mattermost',
                        siteURL: '',
                    };
                }),
            }));

            const result = await serverViewState.handleServerURLValidation({}, 'https://server.com');
            expect(result.status).toBe(URLValidationStatus.OK);
            expect(result.validatedURL).toBe('https://server.com/');
        });

        it('should warn the user when the Site URL is different but unreachable', async () => {
            ServerInfo.mockImplementation(({url}) => ({
                fetchConfigData: jest.fn().mockImplementation(() => {
                    if (url === 'https://mainserver.com/') {
                        return undefined;
                    }
                    return {
                        serverVersion: '7.8.0',
                        siteName: 'Mattermost',
                        siteURL: 'https://mainserver.com/',
                    };
                }),
            }));

            const result = await serverViewState.handleServerURLValidation({}, 'https://server.com');
            expect(result.status).toBe(URLValidationStatus.URLNotMatched);
            expect(result.validatedURL).toBe('https://server.com/');
        });

        it('should warn the user when the Site URL already exists as another server', async () => {
            ServerManager.lookupViewByURL.mockReturnValue({server: {name: 'Server 1', id: 'server-1', url: new URL('https://mainserver.com')}});
            ServerInfo.mockImplementation(() => ({
                fetchConfigData: jest.fn().mockImplementation(() => {
                    return {
                        serverVersion: '7.8.0',
                        siteName: 'Mattermost',
                        siteURL: 'https://mainserver.com',
                    };
                }),
            }));

            const result = await serverViewState.handleServerURLValidation({}, 'https://server.com');
            expect(result.status).toBe(URLValidationStatus.URLExists);
            expect(result.validatedURL).toBe('https://mainserver.com/');
            expect(result.existingServerName).toBe('Server 1');
        });
    });

    describe('handleCloseView', () => {
        const serverViewState = new ServerViewState();

        it('should close the specified view and switch to the next open view', () => {
            ServerManager.getView.mockReturnValue({server: {id: 'server-1'}});
            ServerManager.getLastActiveTabForServer.mockReturnValue({id: 'view-2'});
            serverViewState.handleCloseView(null, 'view-3');
            expect(ServerManager.setViewIsOpen).toBeCalledWith('view-3', false);
            expect(ViewManager.showById).toBeCalledWith('view-2');
        });
    });

    describe('handleOpenView', () => {
        const serverViewState = new ServerViewState();

        it('should open the specified view', () => {
            serverViewState.handleOpenView(null, 'view-1');
            expect(ViewManager.showById).toBeCalledWith('view-1');
        });
    });
});
