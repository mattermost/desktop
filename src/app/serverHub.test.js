// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {session} from 'electron';

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
    session: {
        defaultSession: {
            allowNTLMCredentialsForDomains: jest.fn(),
            clearData: jest.fn(),
        },
        fromPartition: jest.fn(),
    },
}));

jest.mock('common/servers/serverManager', () => ({
    updateCurrentServer: jest.fn(),
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
    addPriorityModal: jest.fn(),
    removeModal: jest.fn(),
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
            expect(ModalManager.addPriorityModal).not.toBeCalled();
        });

        it('should switch to the server and scope the modal to it', () => {
            ModalManager.addPriorityModal.mockReturnValue(new Promise(() => {}));

            serverViewState.showEditServerModal(null, 'server-1');

            expect(ServerManager.updateCurrentServer).toBeCalledWith('server-1');
            expect(ModalManager.addPriorityModal).toBeCalledWith('editServer-server-1', expect.any(String), expect.any(String), expect.any(Object), expect.any(Object), false, 'server-1');
        });

        it('should edit the existing server', async () => {
            const promise = Promise.resolve({server: {
                name: 'updated-server',
                url: 'http://updated-server.com',
            }});
            ModalManager.addPriorityModal.mockReturnValue(promise);

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
            ModalManager.addPriorityModal.mockReturnValue(promise);

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

        it('should switch to the server and scope the modal to it', () => {
            ModalManager.addPriorityModal.mockReturnValue(new Promise(() => {}));

            serverViewState.showRemoveServerModal(null, 'server-1');

            expect(ServerManager.updateCurrentServer).toBeCalledWith('server-1');
            expect(ModalManager.addPriorityModal).toBeCalledWith('removeServer-server-1', expect.any(String), expect.any(String), null, expect.any(Object), false, 'server-1');
        });

        it('should remove the existing server', async () => {
            const promise = Promise.resolve(true);
            ModalManager.addPriorityModal.mockReturnValue(promise);

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
            ModalManager.addPriorityModal.mockReturnValue(promise);

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
        const validationSession = {id: 'validation-session'};

        beforeEach(() => {
            session.fromPartition.mockReturnValue(validationSession);
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

        it('should test the server on a separate session', async () => {
            const pingServer = jest.fn();
            const fetchConfigData = jest.fn().mockReturnValue({
                serverVersion: '7.8.0',
                siteName: 'Mattermost',
                siteURL: 'https://server.com/',
            });
            ServerInfo.mockImplementation(() => ({pingServer, fetchConfigData}));

            await serverViewState.handleServerURLValidation({}, 'https://server.com');

            expect(session.fromPartition).toHaveBeenCalledWith('server-validation');
            expect(pingServer).toHaveBeenCalledWith(validationSession);
            expect(fetchConfigData).toHaveBeenCalledWith(validationSession);
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

        it('should not update the users URL when the Site URL cannot be parsed', async () => {
            ServerInfo.mockImplementation(() => ({
                pingServer: jest.fn().mockImplementation(() => ({
                    status: 'OK',
                })),
                fetchConfigData: jest.fn().mockImplementation(() => {
                    return {
                        serverVersion: '7.8.0',
                        siteName: 'Mattermost',
                        siteURL: 'not-a-url',
                    };
                }),
            }));

            const result = await serverViewState.handleServerURLValidation({}, 'https://server.com');
            expect(result.status).toBe(URLValidationStatus.OK);
            expect(result.validatedURL).toBe('https://server.com/');
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

        it('should preserve the original URL with subpaths when validation fails all the way down', async () => {
            ServerInfo.mockImplementation(() => ({
                pingServer: jest.fn().mockImplementation(() => {
                    throw new Error();
                }),
            }));

            const result = await serverViewState.handleServerURLValidation({}, 'https://not-server.com/some/deep/path');
            expect(result.status).toBe(URLValidationStatus.NotMattermost);
            expect(result.validatedURL).toBe('https://not-server.com/some/deep/path');
        });

        it('should preserve the original URL with subpaths when entered without protocol', async () => {
            ServerInfo.mockImplementation(() => ({
                pingServer: jest.fn().mockImplementation(() => {
                    throw new Error();
                }),
            }));

            const result = await serverViewState.handleServerURLValidation({}, 'not-server.com/some/path');
            expect(result.status).toBe(URLValidationStatus.NotMattermost);
            expect(result.validatedURL).toBe('https://not-server.com/some/path');
        });

        it('should use the matched URL when a subpath-stripped URL finds a valid server', async () => {
            ServerInfo.mockImplementation(({url}) => ({
                pingServer: jest.fn().mockImplementation(() => {
                    if (url !== 'https://server.com/') {
                        throw new Error();
                    }
                    return {status: 'OK'};
                }),
                fetchConfigData: jest.fn().mockImplementation(() => {
                    if (url !== 'https://server.com/') {
                        throw new Error();
                    }
                    return {
                        serverVersion: '7.8.0',
                        siteName: 'Mattermost',
                        siteURL: 'https://server.com/',
                    };
                }),
            }));

            const result = await serverViewState.handleServerURLValidation({}, 'https://server.com/extra/path');
            expect(result.status).toBe(URLValidationStatus.OK);
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

    describe('updateAuthServerAllowlist', () => {
        const {session} = jest.requireMock('electron');

        beforeEach(() => {
            session.defaultSession.allowNTLMCredentialsForDomains.mockClear();
        });

        it('should set the allowlist to the configured server hostnames', () => {
            ServerManager.getAllServers.mockReturnValue([
                {url: new URL('https://server-1.com')},
                {url: new URL('https://server-2.example.org:8443/subpath')},
            ]);
            const hub = new ServerHub();
            hub.updateAuthServerAllowlist();
            expect(session.defaultSession.allowNTLMCredentialsForDomains).
                toHaveBeenCalledWith('server-1.com,server-2.example.org');
        });

        it('should set an empty allowlist when there are no configured servers', () => {
            ServerManager.getAllServers.mockReturnValue([]);
            const hub = new ServerHub();
            hub.updateAuthServerAllowlist();
            expect(session.defaultSession.allowNTLMCredentialsForDomains).toHaveBeenCalledWith('');
        });

        it('should clear server data and refresh the allowlist when a server is removed', () => {
            ServerManager.getAllServers.mockReturnValue([
                {url: new URL('https://server-1.com')},
            ]);
            const hub = new ServerHub();
            hub.handleServerCleanup({id: 'server-2', url: new URL('https://server-2.com')});
            expect(session.defaultSession.clearData).toHaveBeenCalledWith({origins: ['https://server-2.com']});
            expect(session.defaultSession.allowNTLMCredentialsForDomains).toHaveBeenCalledWith('server-1.com');
        });

        // Checks the joined host list for a plain host together with one other host.
        // A host containing a comma, semicolon, asterisk, whitespace, or a leading dot is left out.
        // That includes a host that is only that mark, a mark at the end, and a fullwidth form that parses to one of those marks.
        // An underscore host, an IPv6 host, a host of letters and dots, and a trailing dot are listed with the plain host.
        const plainHost = 'server-1.com';
        it.each([
            {label: 'a comma', hostname: 'a,b.example', expected: plainHost},
            {label: 'a semicolon', hostname: 'a;b.example', expected: plainHost},
            {label: 'an asterisk', hostname: 'a*.example', expected: plainHost},
            {label: 'whitespace', hostname: 'foo bar.example', expected: plainHost},
            {label: 'a leading dot', hostname: '.example.com', expected: plainHost},
            {label: 'only an asterisk', hostname: '*', expected: plainHost},
            {label: 'only a comma', hostname: ',', expected: plainHost},
            {label: 'only a semicolon', hostname: ';', expected: plainHost},
            {label: 'only a dot', hostname: '.', expected: plainHost},
            {label: 'a comma at the end', hostname: 'example.com,', expected: plainHost},
            {label: 'a semicolon at the end', hostname: 'example.com;', expected: plainHost},
            {label: 'an asterisk at the end', hostname: 'example.com*', expected: plainHost},
            {label: 'an asterisk in the middle', hostname: 'ex*ample.com', expected: plainHost},
            {label: 'whitespace at the end', hostname: 'example.com ', expected: plainHost},
            {label: 'a comma and an asterisk', hostname: '*,*.example', expected: plainHost},
            {label: 'a fullwidth asterisk', hostname: 'a\uFF0Ab.example', expected: plainHost},
            {label: 'a fullwidth comma', hostname: 'a\uFF0Cb.example', expected: plainHost},
            {label: 'a fullwidth semicolon', hostname: 'a\uFF1Bb.example', expected: plainHost},
            {label: 'a fullwidth dot at the start', hostname: '\u3002example.com', expected: plainHost},
            {label: 'an empty value', hostname: '', expected: plainHost},
            {label: 'an underscore', hostname: 'internal_host.example', expected: `${plainHost},internal_host.example`},
            {label: 'an IPv6 address', hostname: '[2001:db8::1]', expected: `${plainHost},[2001:db8::1]`},
            {label: 'only letters and dots', hostname: 'good.example', expected: `${plainHost},good.example`},
            {label: 'a trailing dot', hostname: 'example.com.', expected: `${plainHost},example.com.`},
        ])('should build the host list from a plain host and a host with $label', ({hostname, expected}) => {
            const url = (!hostname || (/\s/).test(hostname)) ? {hostname} : new URL(`https://${hostname}/`);
            ServerManager.getAllServers.mockReturnValue([
                {url: new URL('https://server-1.com')},
                {url},
            ]);
            const hub = new ServerHub();
            hub.updateAuthServerAllowlist();
            expect(session.defaultSession.allowNTLMCredentialsForDomains).toHaveBeenCalledWith(expected);
        });
    });

    describe('server url hostnames', () => {
        const hub = new ServerHub();
        const typedURL = 'https://server.com';
        const plainURL = 'https://server.example.com';

        // Whitespace does not parse as a url, so it is only checked on add and edit.
        // A value with no scheme is checked beside the https form produced when a scheme is added.
        const modalPaths = ['add', 'edit', 'site url', 'new server modal', 'edit server modal'];
        const serverURLCases = [
            ['a comma', 'https://a,b.example', modalPaths],
            ['a semicolon', 'https://a;b.example', ['add', 'edit', 'site url']],
            ['an asterisk', 'https://a*.example', ['add', 'edit', 'site url']],
            ['a leading dot', 'https://.example.com', ['add', 'edit', 'site url']],
            ['whitespace', 'https://foo bar.example', ['add', 'edit']],
            ['a percent-encoded asterisk', 'https://a%2A.example', ['add', 'edit', 'site url']],
            ['a percent-encoded comma', 'https://a%2C.example', ['add', 'edit', 'site url']],
            ['a percent-encoded semicolon', 'https://a%3B.example', ['add', 'edit', 'site url']],
            ['a percent-encoded leading dot', 'https://%2Eexample.com', ['add', 'edit', 'site url']],
            ['only an asterisk', 'https://*', ['add', 'edit', 'site url']],
            ['only a comma', 'https://,', ['add', 'edit', 'site url']],
            ['only a semicolon', 'https://;', ['add', 'edit', 'site url']],
            ['only a dot', 'https://.', ['add', 'edit', 'site url']],
            ['a comma at the end', 'https://example.com,', ['add', 'edit', 'site url']],
            ['a semicolon at the end', 'https://example.com;', ['add', 'edit', 'site url']],
            ['an asterisk at the end', 'https://example.com*', ['add', 'edit', 'site url']],
            ['an asterisk in the middle', 'https://ex*ample.com', ['add', 'edit', 'site url']],
            ['whitespace at the end', 'https://example.com ', ['add', 'edit']],
            ['a comma and an asterisk', 'https://*,*.example', modalPaths],
            ['a value without a scheme', '*,*.example', modalPaths],
            ['another value without a scheme', 'a,b.example', modalPaths],
            ['a fullwidth asterisk', 'https://a\uFF0Ab.example', ['add', 'edit', 'site url']],
            ['a fullwidth comma', 'https://a\uFF0Cb.example', ['add', 'edit', 'site url']],
            ['a fullwidth semicolon', 'https://a\uFF1Bb.example', ['add', 'edit', 'site url']],
            ['a fullwidth dot at the start', 'https://\u3002example.com', ['add', 'edit', 'site url']],
            ['uppercase letters', 'https://A,B.EXAMPLE', ['add', 'edit', 'site url']],
            ['a userinfo prefix', 'https://user:pass@a,b.example', ['add', 'edit', 'site url']],
            ['only the scheme', 'https://', modalPaths],
            ['an empty url', '', modalPaths],
            ['a missing url', undefined, ['add', 'edit', 'new server modal', 'edit server modal']],
        ].flatMap(([label, url, paths]) => paths.map((path) => ({
            label,
            url,
            path,
            outcome: 'omit',
        }))).concat([
            {label: 'only letters and dots', url: plainURL, path: 'add', outcome: 'keep'},
            {label: 'only letters and dots', url: plainURL, path: 'edit', outcome: 'keep'},
            {label: 'an underscore', url: 'https://internal_host.example', path: 'add', outcome: 'keep'},
            {label: 'an underscore', url: 'https://internal_host.example', path: 'edit', outcome: 'keep'},
            {label: 'an IPv6 address', url: 'https://[2001:db8::1]/', path: 'add', outcome: 'keep'},
            {label: 'an IPv6 address', url: 'https://[2001:db8::1]/', path: 'edit', outcome: 'keep'},
        ]);

        beforeEach(() => {
            ServerManager.addServer.mockReset();
            ServerManager.editServer.mockReset();
            ServerManager.lookupServerByURL.mockReset();
            ServerInfo.mockReset();
        });

        // Checks add, edit, and a remote site url. The server url is stored only when the hostname is one plain host.
        it.each(serverURLCases)('should $outcome the server url on $path for $label', async ({url, path, outcome}) => {
            const keep = outcome === 'keep';
            if (path === 'add') {
                const server = {name: 'server', url};
                await hub.handleAddServer({}, server);
                expect(ServerManager.addServer.mock.calls).toEqual(keep ? [[server]] : []);
                return;
            }

            if (path === 'edit') {
                const server = {id: 'server-1', name: 'server', url, isPredefined: false};
                await hub.handleEditServer({}, server);
                expect(ServerManager.editServer.mock.calls).toEqual(keep ? [['server-1', server]] : []);
                return;
            }

            if (path === 'new server modal') {
                getLocalPreload.mockReturnValue('/some/preload.js');
                MainWindow.get.mockReturnValue({});
                const data = {name: 'server', url};
                const promise = Promise.resolve(data);
                ModalManager.addModal.mockReturnValue(promise);
                hub.showNewServerModal();
                await promise;
                expect(ServerManager.addServer.mock.calls).toEqual(keep ? [[data, undefined]] : []);
                return;
            }

            if (path === 'edit server modal') {
                getLocalPreload.mockReturnValue('/some/preload.js');
                MainWindow.get.mockReturnValue({});
                ServerManager.getServer.mockReturnValue({
                    id: 'server-1',
                    isPredefined: false,
                    toUniqueServer: jest.fn(),
                });
                const data = {server: {name: 'server', url}, permissions: {}};
                const promise = Promise.resolve(data);
                ModalManager.addPriorityModal.mockReturnValue(promise);
                hub.showEditServerModal(null, 'server-1');
                await promise;
                expect(ServerManager.editServer.mock.calls).toEqual(keep ? [['server-1', data.server]] : []);
                return;
            }

            ServerInfo.mockImplementation(() => ({
                pingServer: jest.fn().mockImplementation(() => ({status: 'OK'})),
                fetchConfigData: jest.fn().mockImplementation(() => ({
                    serverVersion: '7.8.0',
                    siteName: 'Mattermost',
                    siteURL: url,
                })),
            }));
            const result = await hub.handleServerURLValidation({}, typedURL);

            // Checks that the remote site url is not copied onto the typed server url.
            expect(result.validatedURL).toBe(`${typedURL}/`);
        });
    });
});
