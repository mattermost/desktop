// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Config from 'common/config';
import {getDefaultTeamWithTabsFromTeam} from 'common/tabs/TabView';

import {getLocalURLString, getLocalPreload} from 'main/utils';
import ModalManager from 'main/views/modalManager';
import WindowManager from 'main/windows/windowManager';

import {
    handleOpenTab,
    handleCloseTab,
    handleNewServerModal,
    handleEditServerModal,
    handleRemoveServerModal,
    handleWelcomeScreenModal,
} from './intercom';

jest.mock('common/config', () => ({
    set: jest.fn(),
}));
jest.mock('common/tabs/TabView', () => ({
    getDefaultTeamWithTabsFromTeam: jest.fn(),
}));
jest.mock('main/notifications', () => ({}));
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
        beforeEach(() => {
            Config.set.mockImplementation((name, value) => {
                Config[name] = value;
            });
            Config.teams = JSON.parse(JSON.stringify(teams));
        });

        afterEach(() => {
            delete Config.teams;
        });

        it('should close the specified tab and switch to the next open tab', () => {
            handleCloseTab(null, 'server-1', 'tab-3');
            expect(WindowManager.switchTab).toBeCalledWith('server-1', 'tab-2');
            expect(Config.teams.find((team) => team.name === 'server-1').tabs.find((tab) => tab.name === 'tab-3').isOpen).toBe(false);
        });
    });

    describe('handleOpenTab', () => {
        beforeEach(() => {
            Config.set.mockImplementation((name, value) => {
                Config[name] = value;
            });
            Config.teams = JSON.parse(JSON.stringify(teams));
        });

        afterEach(() => {
            delete Config.teams;
        });

        it('should open the specified tab', () => {
            handleOpenTab(null, 'server-1', 'tab-1');
            expect(WindowManager.switchTab).toBeCalledWith('server-1', 'tab-1');
            expect(Config.teams.find((team) => team.name === 'server-1').tabs.find((tab) => tab.name === 'tab-1').isOpen).toBe(true);
        });
    });

    describe('handleNewServerModal', () => {
        beforeEach(() => {
            getLocalURLString.mockReturnValue('/some/index.html');
            getLocalPreload.mockReturnValue('/some/preload.js');
            WindowManager.getMainWindow.mockReturnValue({});

            Config.set.mockImplementation((name, value) => {
                Config[name] = value;
            });
            Config.teams = JSON.parse(JSON.stringify(teams));

            getDefaultTeamWithTabsFromTeam.mockImplementation((team) => ({
                ...team,
                tabs,
            }));
        });

        afterEach(() => {
            delete Config.teams;
        });

        it('should add new team to the config', async () => {
            const promise = Promise.resolve({
                name: 'new-team',
                url: 'http://new-team.com',
            });
            ModalManager.addModal.mockReturnValue(promise);

            handleNewServerModal();
            await promise;
            expect(Config.teams).toContainEqual(expect.objectContaining({
                name: 'new-team',
                url: 'http://new-team.com',
                tabs,
            }));
            expect(WindowManager.switchServer).toBeCalledWith('new-team', true);
        });
    });

    describe('handleEditServerModal', () => {
        beforeEach(() => {
            getLocalURLString.mockReturnValue('/some/index.html');
            getLocalPreload.mockReturnValue('/some/preload.js');
            WindowManager.getMainWindow.mockReturnValue({});

            Config.set.mockImplementation((name, value) => {
                Config[name] = value;
            });
            Config.teams = JSON.parse(JSON.stringify(teams));
        });

        afterEach(() => {
            delete Config.teams;
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
            expect(Config.teams).not.toContainEqual(expect.objectContaining({
                name: 'server-1',
                url: 'http://server-1.com',
                tabs,
            }));
            expect(Config.teams).toContainEqual(expect.objectContaining({
                name: 'new-team',
                url: 'http://new-team.com',
                tabs,
            }));
        });
    });

    describe('handleRemoveServerModal', () => {
        beforeEach(() => {
            getLocalURLString.mockReturnValue('/some/index.html');
            getLocalPreload.mockReturnValue('/some/preload.js');
            WindowManager.getMainWindow.mockReturnValue({});

            Config.set.mockImplementation((name, value) => {
                Config[name] = value;
            });
            Config.teams = JSON.parse(JSON.stringify(teams));
        });

        afterEach(() => {
            delete Config.teams;
        });

        it('should remove the existing team', async () => {
            const promise = Promise.resolve(true);
            ModalManager.addModal.mockReturnValue(promise);

            handleRemoveServerModal(null, 'server-1');
            await promise;
            expect(Config.teams).not.toContainEqual(expect.objectContaining({
                name: 'server-1',
                url: 'http://server-1.com',
                tabs,
            }));
        });

        it('should not remove the existing team when clicking Cancel', async () => {
            const promise = Promise.resolve(false);
            ModalManager.addModal.mockReturnValue(promise);

            expect(Config.teams).toContainEqual(expect.objectContaining({
                name: 'server-1',
                url: 'http://server-1.com',
                tabs,
            }));

            handleRemoveServerModal(null, 'server-1');
            await promise;
            expect(Config.teams).toContainEqual(expect.objectContaining({
                name: 'server-1',
                url: 'http://server-1.com',
                tabs,
            }));
        });
    });

    describe('handleWelcomeScreenModal', () => {
        beforeEach(() => {
            getLocalURLString.mockReturnValue('/some/index.html');
            getLocalPreload.mockReturnValue('/some/preload.js');
            WindowManager.getMainWindow.mockReturnValue({});

            Config.set.mockImplementation((name, value) => {
                Config[name] = value;
            });
            Config.teams = JSON.parse(JSON.stringify([]));
        });

        it('should show welcomeScreen modal', async () => {
            const promise = Promise.resolve({});
            ModalManager.addModal.mockReturnValue(promise);

            handleWelcomeScreenModal();
            expect(ModalManager.addModal).toHaveBeenCalledWith('welcomeScreen', '/some/index.html', '/some/preload.js', [], {}, true);
        });
    });
});
