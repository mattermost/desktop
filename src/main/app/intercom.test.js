// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Config from 'common/config';
import {getDefaultTeamWithTabsFromTeam} from 'common/tabs/TabView';

import {getLocalURLString, getLocalPreload} from 'main/utils';
import ServerManager from 'main/server/serverManager';
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
jest.mock('main/server/serverManager', () => ({
    toggleTab: jest.fn(),
    getAllServers: jest.fn(),
    hasServers: jest.fn(),
    addServer: jest.fn(),
    editServer: jest.fn(),
    removeServer: jest.fn(),
}));
jest.mock('main/utils', () => ({
    getLocalPreload: jest.fn(),
    getLocalURLString: jest.fn(),
}));
jest.mock('main/views/modalManager', () => ({
    addModal: jest.fn(),
}));
jest.mock('main/windows/windowManager', () => ({
    getMainWindow: jest.fn(),
    switchServer: jest.fn(),
    switchTab: jest.fn(),
}));

jest.mock('./app', () => ({}));
jest.mock('./utils', () => ({
    updateServerInfos: jest.fn(),
}));

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
        name: 'server-1',
        url: 'http://server-1.com',
        tabs,
    },
];

describe('main/app/intercom', () => {
    describe('handleCloseTab', () => {
        let teamsCopy;

        beforeEach(() => {
            teamsCopy = JSON.parse(JSON.stringify(teams));
            ServerManager.toggleTab.mockImplementation(() => {
                teamsCopy = [
                    {
                        ...teams[0],
                        tabs: [
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
                                isOpen: false,
                            },
                        ],
                    },
                ];
            });
            ServerManager.getAllServers.mockReturnValue(teamsCopy);
        });

        it('should close the specified tab and switch to the next open tab', () => {
            handleCloseTab(null, 'server-1', 'tab-3');
            expect(WindowManager.switchTab).toBeCalledWith('server-1', 'tab-2');
            expect(teamsCopy.find((team) => team.name === 'server-1').tabs.find((tab) => tab.name === 'tab-3').isOpen).toBe(false);
        });
    });

    describe('handleOpenTab', () => {
        it('should open the specified tab', () => {
            handleOpenTab(null, 'server-1', 'tab-1');
            expect(WindowManager.switchTab).toBeCalledWith('server-1', 'tab-1');
        });
    });

    describe('handleNewServerModal', () => {
        let teamsCopy;

        beforeEach(() => {
            getLocalURLString.mockReturnValue('/some/index.html');
            getLocalPreload.mockReturnValue('/some/preload.js');
            WindowManager.getMainWindow.mockReturnValue({});

            teamsCopy = JSON.parse(JSON.stringify(teams));
            ServerManager.addServer.mockImplementation(() => {
                const newTeam = {
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
                name: 'new-team',
                url: 'http://new-team.com',
                tabs,
            }));
            expect(WindowManager.switchServer).toBeCalledWith('new-team', true);
        });
    });

    describe('handleEditServerModal', () => {
        let teamsCopy;

        beforeEach(() => {
            getLocalURLString.mockReturnValue('/some/index.html');
            getLocalPreload.mockReturnValue('/some/preload.js');
            WindowManager.getMainWindow.mockReturnValue({});

            teamsCopy = JSON.parse(JSON.stringify(teams));
            ServerManager.editServer.mockImplementation((team, index) => {
                if (index < 0) {
                    return;
                }
                const newTeam = {
                    ...teamsCopy[0],
                    name: 'new-team',
                    url: 'http://new-team.com',
                };
                teamsCopy = [newTeam];
            });
            ServerManager.getAllServers.mockReturnValue(teamsCopy);
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
                name: 'server-1',
                url: 'http://server-1.com',
                tabs,
            }));
            expect(teamsCopy).toContainEqual(expect.objectContaining({
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
            WindowManager.getMainWindow.mockReturnValue({});

            teamsCopy = JSON.parse(JSON.stringify(teams));
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
                name: 'server-1',
                url: 'http://server-1.com',
                tabs,
            }));
        });

        it('should not remove the existing team when clicking Cancel', async () => {
            const promise = Promise.resolve(false);
            ModalManager.addModal.mockReturnValue(promise);

            expect(teamsCopy).toContainEqual(expect.objectContaining({
                name: 'server-1',
                url: 'http://server-1.com',
                tabs,
            }));

            handleRemoveServerModal(null, 'server-1');
            await promise;
            expect(teamsCopy).toContainEqual(expect.objectContaining({
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
            WindowManager.getMainWindow.mockReturnValue({});

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
            WindowManager.getMainWindow.mockReturnValue({
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
