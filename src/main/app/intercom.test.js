// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Config from 'common/config';
import {getDefaultTeamWithTabsFromTeam} from 'common/tabs/TabView';

import {getLocalURLString, getLocalPreload} from 'main/utils';
import ServerManager from 'common/servers/serverManager';
import MainWindow from 'main/windows/mainWindow';
import ModalManager from 'main/views/modalManager';
import WindowManager from 'main/windows/windowManager';

import {
    handleOpenTab,
    handleCloseTab,
    handleNewServerModal,
    handleEditServerModal,
    handleRemoveServerModal,
    handleWelcomeScreenModal,
    handleMainWindowIsShown,
} from './intercom';

jest.mock('common/config', () => ({
    set: jest.fn(),
}));
jest.mock('common/tabs/TabView', () => ({
    getDefaultTeamWithTabsFromTeam: jest.fn(),
}));
jest.mock('main/notifications', () => ({}));
jest.mock('common/servers/serverManager', () => ({
    toggleTab: jest.fn(),
    getAllServers: jest.fn(),
    hasServers: jest.fn(),
    addServer: jest.fn(),
    editServer: jest.fn(),
    removeServer: jest.fn(),
    getServer: jest.fn(),
    getTab: jest.fn(),
    getLastActiveTabForServer: jest.fn(),
}));
jest.mock('main/utils', () => ({
    getLocalPreload: jest.fn(),
    getLocalURLString: jest.fn(),
}));
jest.mock('main/views/modalManager', () => ({
    addModal: jest.fn(),
}));
jest.mock('main/windows/windowManager', () => ({
    switchServer: jest.fn(),
    switchTab: jest.fn(),
}));
jest.mock('main/windows/mainWindow', () => ({
    get: jest.fn(),
}));

jest.mock('./app', () => ({}));

const tabs = [
    {
        name: 'tab-1',
        order: 0,
        isOpen: false,
    },
    {
        name: 'tab-2',
        order: 2,
        isOpen: true,
    },
    {
        name: 'tab-3',
        order: 1,
        isOpen: true,
    },
];
const teams = [
    {
        id: 'server-1',
        name: 'server-1',
        url: 'http://server-1.com',
        tabs,
    },
];

describe('main/app/intercom', () => {
    describe('handleCloseTab', () => {
        it('should close the specified tab and switch to the next open tab', () => {
            ServerManager.getTab.mockReturnValue({server: {id: 'server-1'}});
            ServerManager.getLastActiveTabForServer.mockReturnValue({id: 'tab-2'});
            handleCloseTab(null, 'tab-3');
            expect(ServerManager.toggleTab).toBeCalledWith('tab-3', false);
            expect(WindowManager.switchTab).toBeCalledWith('tab-2');
        });
    });

    describe('handleOpenTab', () => {
        it('should open the specified tab', () => {
            handleOpenTab(null, 'tab-1');
            expect(WindowManager.switchTab).toBeCalledWith('tab-1');
        });
    });

    describe('handleNewServerModal', () => {
        let teamsCopy;

        beforeEach(() => {
            getLocalURLString.mockReturnValue('/some/index.html');
            getLocalPreload.mockReturnValue('/some/preload.js');
            MainWindow.get.mockReturnValue({});

            teamsCopy = JSON.parse(JSON.stringify(teams));
            ServerManager.getAllServers.mockReturnValue([]);
            ServerManager.addServer.mockImplementation(() => {
                const newTeam = {
                    id: 'server-1',
                    name: 'new-team',
                    url: 'http://new-team.com',
                    tabs,
                };
                teamsCopy = [
                    ...teamsCopy,
                    newTeam,
                ];
                return newTeam;
            });
            ServerManager.hasServers.mockReturnValue(Boolean(teamsCopy.length));

            getDefaultTeamWithTabsFromTeam.mockImplementation((team) => ({
                ...team,
                tabs,
            }));
        });

        it('should add new team to the config', async () => {
            const promise = Promise.resolve({
                name: 'new-team',
                url: 'http://new-team.com',
            });
            ModalManager.addModal.mockReturnValue(promise);

            handleNewServerModal();
            await promise;
            expect(teamsCopy).toContainEqual(expect.objectContaining({
                id: 'server-1',
                name: 'new-team',
                url: 'http://new-team.com',
                tabs,
            }));
            expect(WindowManager.switchServer).toBeCalledWith('server-1', true);
        });
    });

    describe('handleEditServerModal', () => {
        let teamsCopy;

        beforeEach(() => {
            getLocalURLString.mockReturnValue('/some/index.html');
            getLocalPreload.mockReturnValue('/some/preload.js');
            MainWindow.get.mockReturnValue({});

            teamsCopy = JSON.parse(JSON.stringify(teams));
            ServerManager.getServer.mockImplementation((id) => {
                if (id !== teamsCopy[0].id) {
                    return undefined;
                }
                return {...teamsCopy[0], toMattermostTeam: jest.fn()};
            });
            ServerManager.editServer.mockImplementation((id, team) => {
                if (id !== teamsCopy[0].id) {
                    return;
                }
                const newTeam = {
                    ...teamsCopy[0],
                    ...team,
                };
                teamsCopy = [newTeam];
            });
            ServerManager.getAllServers.mockReturnValue(teamsCopy.map((team) => ({...team, toMattermostTeam: jest.fn()})));
        });

        it('should do nothing when the server cannot be found', () => {
            handleEditServerModal(null, 'bad-server');
            expect(ModalManager.addModal).not.toBeCalled();
        });

        it('should edit the existing team', async () => {
            const promise = Promise.resolve({
                name: 'new-team',
                url: 'http://new-team.com',
            });
            ModalManager.addModal.mockReturnValue(promise);

            handleEditServerModal(null, 'server-1');
            await promise;
            expect(teamsCopy).not.toContainEqual(expect.objectContaining({
                id: 'server-1',
                name: 'server-1',
                url: 'http://server-1.com',
                tabs,
            }));
            expect(teamsCopy).toContainEqual(expect.objectContaining({
                id: 'server-1',
                name: 'new-team',
                url: 'http://new-team.com',
                tabs,
            }));
        });
    });

    describe('handleRemoveServerModal', () => {
        let teamsCopy;

        beforeEach(() => {
            getLocalURLString.mockReturnValue('/some/index.html');
            getLocalPreload.mockReturnValue('/some/preload.js');
            MainWindow.get.mockReturnValue({});

            teamsCopy = JSON.parse(JSON.stringify(teams));
            ServerManager.getServer.mockImplementation((id) => {
                if (id !== teamsCopy[0].id) {
                    return undefined;
                }
                return teamsCopy[0];
            });
            ServerManager.removeServer.mockImplementation(() => {
                teamsCopy = [];
            });
            ServerManager.getAllServers.mockReturnValue(teamsCopy);
        });

        it('should remove the existing team', async () => {
            const promise = Promise.resolve(true);
            ModalManager.addModal.mockReturnValue(promise);

            handleRemoveServerModal(null, 'server-1');
            await promise;
            expect(teamsCopy).not.toContainEqual(expect.objectContaining({
                id: 'server-1',
                name: 'server-1',
                url: 'http://server-1.com',
                tabs,
            }));
        });

        it('should not remove the existing team when clicking Cancel', async () => {
            const promise = Promise.resolve(false);
            ModalManager.addModal.mockReturnValue(promise);

            expect(teamsCopy).toContainEqual(expect.objectContaining({
                id: 'server-1',
                name: 'server-1',
                url: 'http://server-1.com',
                tabs,
            }));

            handleRemoveServerModal(null, 'server-1');
            await promise;
            expect(teamsCopy).toContainEqual(expect.objectContaining({
                id: 'server-1',
                name: 'server-1',
                url: 'http://server-1.com',
                tabs,
            }));
        });
    });

    describe('handleWelcomeScreenModal', () => {
        let teamsCopy;

        beforeEach(() => {
            getLocalURLString.mockReturnValue('/some/index.html');
            getLocalPreload.mockReturnValue('/some/preload.js');
            MainWindow.get.mockReturnValue({});

            teamsCopy = [];
            Config.set.mockImplementation((name, value) => {
                teamsCopy = value;
            });
            ServerManager.getAllServers.mockReturnValue(teamsCopy);
            ServerManager.hasServers.mockReturnValue(Boolean(teamsCopy.length));
        });

        it('should show welcomeScreen modal', async () => {
            const promise = Promise.resolve({});
            ModalManager.addModal.mockReturnValue(promise);

            handleWelcomeScreenModal();
            expect(ModalManager.addModal).toHaveBeenCalledWith('welcomeScreen', '/some/index.html', '/some/preload.js', [], {}, true);
        });
    });

    describe('handleMainWindowIsShown', () => {
        it('MM-48079 should not show onboarding screen or server screen if GPO server is pre-configured', () => {
            getLocalURLString.mockReturnValue('/some/index.html');
            getLocalPreload.mockReturnValue('/some/preload.js');
            MainWindow.get.mockReturnValue({
                isVisible: () => true,
            });
            ServerManager.hasServers.mockReturnValue(true);

            Config.set.mockImplementation((name, value) => {
                Config[name] = value;
            });
            Config.registryConfigData = {
                teams: JSON.parse(JSON.stringify([{
                    name: 'test-team',
                    order: 0,
                    url: 'https://someurl.here',
                }])),
            };

            handleMainWindowIsShown();
            expect(ModalManager.addModal).not.toHaveBeenCalled();
        });
    });
});
