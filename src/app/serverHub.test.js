// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import MainWindow from 'app/mainWindow/mainWindow';
import ModalManager from 'app/mainWindow/modals/modalManager';
import {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';
import {URLValidationStatus} from 'common/utils/constants';
import PermissionsManager from 'main/security/permissionsManager';
import {ServerInfo} from 'main/server/serverInfo';
import {getLocalPreload} from 'main/utils';

import {ServerHub} from './serverHub';

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
    lookupServerByURL: jest.fn(),
    getOrderedServers: jest.fn(),
    on: jest.fn(),
    emit: jest.fn(),
}));
jest.mock('common/servers/MattermostServer', () => ({
    MattermostServer: jest.fn(),
}));
jest.mock('main/server/serverInfo', () => ({
    ServerInfo: jest.fn(),
}));
jest.mock('app/mainWindow/modals/modalManager', () => ({
    addModal: jest.fn(),
}));
jest.mock('main/utils', () => ({
    getLocalPreload: jest.fn(),
}));
jest.mock('app/mainWindow/mainWindow', () => ({
    get: jest.fn(),
    show: jest.fn(),
    on: jest.fn(),
}));

jest.mock('common/views/viewManager', () => ({
    getView: jest.fn(),
    showById: jest.fn(),
    on: jest.fn(),
}));
jest.mock('main/security/permissionsManager', () => ({
    getForServer: jest.fn(),
    setForServer: jest.fn(),
}));
jest.mock('main/secureStorage', () => ({
    setSecret: jest.fn(),
    deleteSecret: jest.fn(),
    getSecret: jest.fn(),
}));

const testServers = [
    {
        id: 'server-1',
        name: 'Test Server 1',
        url: 'http://server-1.com',
    },
    {
        id: 'server-2',
        name: 'Test Server 2',
        url: 'http://server-2.com',
    },
    {
        id: 'server-3',
        name: 'Test Server 3',
        url: 'http://server-3.com',
    },
];

describe('app/serverViewState', () => {
    describe('showNewServerModal', () => {
        const serverViewState = new ServerHub();
        let serversCopy;

        beforeEach(() => {
            getLocalPreload.mockReturnValue('/some/preload.js');
            MainWindow.get.mockReturnValue({});

            serversCopy = JSON.parse(JSON.stringify(testServers));
            ServerManager.getAllServers.mockReturnValue([]);
            ServerManager.addServer.mockImplementation((serverData) => {
                const newServer = {
                    id: 'server-4',
                    name: serverData.name,
                    url: serverData.url,
                };
                serversCopy = [
                    ...serversCopy,
                    newServer,
                ];
                return newServer;
            });
            ServerManager.hasServers.mockReturnValue(Boolean(serversCopy.length));
            ServerManager.getServerLog.mockReturnValue({debug: jest.fn(), error: jest.fn()});
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
                id: 'server-4',
                name: 'new-server',
                url: 'http://new-server.com',
            }));
        });
    });

    describe('handleEditServerModal', () => {
        const serverViewState = new ServerHub();
        let serversCopy;

        beforeEach(() => {
            getLocalPreload.mockReturnValue('/some/preload.js');
            MainWindow.get.mockReturnValue({});

            serversCopy = JSON.parse(JSON.stringify(testServers));
            ServerManager.getServer.mockImplementation((id) => {
                const server = serversCopy.find((s) => s.id === id);
                return server ? {...server, toUniqueServer: jest.fn()} : undefined;
            });
            ServerManager.editServer.mockImplementation((id, serverData) => {
                const serverIndex = serversCopy.findIndex((s) => s.id === id);
                if (serverIndex >= 0) {
                    serversCopy[serverIndex] = {
                        ...serversCopy[serverIndex],
                        ...serverData,
                    };
                }
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
                name: 'updated-server',
                url: 'http://updated-server.com',
            }});
            ModalManager.addModal.mockReturnValue(promise);

            serverViewState.showEditServerModal(null, 'server-1');
            await promise;

            expect(serversCopy).not.toContainEqual(expect.objectContaining({
                id: 'server-1',
                name: 'Test Server 1',
                url: 'http://server-1.com',
            }));
            expect(serversCopy).toContainEqual(expect.objectContaining({
                id: 'server-1',
                name: 'updated-server',
                url: 'http://updated-server.com',
            }));
        });

        it('should edit the permissions', async () => {
            const promise = Promise.resolve({server: {
                name: 'Test Server 1',
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

            // Wait for the async .then() callback to execute
            await new Promise((resolve) => setImmediate(resolve));

            expect(PermissionsManager.setForServer).toHaveBeenCalledWith(expect.objectContaining({
                id: 'server-1',
                name: 'Test Server 1',
                url: 'http://server-1.com',
            }), {
                notifications: {
                    alwaysDeny: true,
                },
            });
        });
    });

    describe('handleRemoveServerModal', () => {
        const serverViewState = new ServerHub();
        let serversCopy;

        beforeEach(() => {
            getLocalPreload.mockReturnValue('/some/preload.js');
            MainWindow.get.mockReturnValue({});

            serversCopy = JSON.parse(JSON.stringify(testServers));
            ServerManager.getServer.mockImplementation((id) => {
                return serversCopy.find((s) => s.id === id);
            });
            ServerManager.removeServer.mockImplementation((id) => {
                serversCopy = serversCopy.filter((s) => s.id !== id);
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
                name: 'Test Server 1',
                url: 'http://server-1.com',
            }));
        });

        it('should not remove the existing server when clicking Cancel', async () => {
            const promise = Promise.resolve(false);
            ModalManager.addModal.mockReturnValue(promise);

            expect(serversCopy).toContainEqual(expect.objectContaining({
                id: 'server-1',
                name: 'Test Server 1',
                url: 'http://server-1.com',
            }));

            serverViewState.showRemoveServerModal(null, 'server-1');
            await promise;

            expect(serversCopy).toContainEqual(expect.objectContaining({
                id: 'server-1',
                name: 'Test Server 1',
                url: 'http://server-1.com',
            }));
        });
    });

    describe('handleServerURLValidation', () => {
        const serverViewState = new ServerHub();

        beforeEach(() => {
            MattermostServer.mockImplementation(({url}) => ({url}));
            ServerInfo.mockImplementation(({url}) => ({
                pingServer: jest.fn().mockImplementation(() => ({
                    status: 'OK',
                })),
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
            ServerManager.lookupServerByURL.mockReturnValue({id: 'server-1', url: new URL('https://server.com')});
            const result = await serverViewState.handleServerURLValidation({}, 'https://server.com');
            expect(result.status).toBe(URLValidationStatus.URLExists);
            expect(result.validatedURL).toBe('https://server.com/');
        });

        it('should generate a warning if the server exists when editing', async () => {
            ServerManager.lookupServerByURL.mockReturnValue({name: 'Test Server 1', id: 'server-1', url: new URL('https://server.com')});
            const result = await serverViewState.handleServerURLValidation({}, 'https://server.com', 'server-2');
            expect(result.status).toBe(URLValidationStatus.URLExists);
            expect(result.validatedURL).toBe('https://server.com/');
            expect(result.existingServerName).toBe('Test Server 1');
        });

        it('should not generate a warning if editing the same server', async () => {
            ServerManager.lookupServerByURL.mockReturnValue({name: 'Test Server 1', id: 'server-1', url: new URL('https://server.com')});
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
                pingServer: jest.fn().mockImplementation(() => ({
                    status: 'OK',
                })),
                fetchConfigData: jest.fn().mockImplementation(() => {
                    if (url.startsWith('https:')) {
                        throw new Error('HTTPS failed');
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
                pingServer: jest.fn().mockImplementation(() => ({
                    status: 'OK',
                })),
                fetchConfigData: jest.fn().mockImplementation(() => {
                    if (url.startsWith('https:')) {
                        throw new Error('HTTPS failed');
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
                pingServer: jest.fn().mockImplementation(() => {
                    throw new Error();
                }),
            }));

            const result = await serverViewState.handleServerURLValidation({}, 'https://not-server.com');
            expect(result.status).toBe(URLValidationStatus.NotMattermost);
            expect(result.validatedURL).toBe('https://not-server.com');
        });

        it('should update the users URL when the Site URL is different', async () => {
            ServerInfo.mockImplementation(() => ({
                pingServer: jest.fn().mockImplementation(() => ({
                    status: 'OK',
                })),
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
                pingServer: jest.fn().mockImplementation(() => ({
                    status: 'OK',
                })),
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
                pingServer: jest.fn().mockImplementation(() => ({
                    status: 'OK',
                })),
                fetchConfigData: jest.fn().mockImplementation(() => {
                    if (url === 'https://mainserver.com/') {
                        throw new Error('Site URL unreachable');
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
            ServerManager.lookupServerByURL.mockReturnValue({name: 'Test Server 1', id: 'server-1', url: new URL('https://mainserver.com')});
            ServerInfo.mockImplementation(() => ({
                pingServer: jest.fn().mockImplementation(() => ({
                    status: 'OK',
                })),
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
            expect(result.existingServerName).toBe('Test Server 1');
        });
    });
});
