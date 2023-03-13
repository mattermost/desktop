// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Config from 'common/config';

import {TAB_MESSAGING, TAB_FOCALBOARD, TAB_PLAYBOOKS} from 'common/tabs/TabView';
import Utils from 'common/utils/util';

import {ServerInfo} from 'main/server/serverInfo';

import {ServerManager} from './serverManager';

jest.mock('common/config', () => ({
    set: jest.fn(),
}));
jest.mock('common/utils/util', () => ({
    isVersionGreaterThanOrEqualTo: jest.fn(),
}));
jest.mock('main/server/serverInfo', () => ({
    ServerInfo: jest.fn(),
}));

describe('main/server/serverManager', () => {
    describe('updateServerInfos', () => {
        const serverManager = new ServerManager();
        const tabs = [
            {
                name: TAB_MESSAGING,
                order: 0,
                isOpen: true,
            },
            {
                name: TAB_FOCALBOARD,
                order: 2,
            },
            {
                name: TAB_PLAYBOOKS,
                order: 1,
            },
        ];
        const teams = [
            {
                name: 'server-1',
                url: 'http://server-1.com',
                tabs,
            },
        ];
        let teamsCopy;

        beforeEach(() => {
            Utils.isVersionGreaterThanOrEqualTo.mockImplementation((version) => version === '6.0.0');
            teamsCopy = JSON.parse(JSON.stringify(teams));
            Config.set.mockImplementation((name, value) => {
                teamsCopy = value;
            });
            serverManager.getAllServers = jest.fn().mockReturnValue(teamsCopy);
        });

        it('should open all tabs', async () => {
            ServerInfo.mockReturnValue({promise: {
                name: 'server-1',
                siteURL: 'http://server-1.com',
                serverVersion: '6.0.0',
                hasPlaybooks: true,
                hasFocalboard: true,
            }});

            serverManager.updateServerInfos(teamsCopy);
            await new Promise(setImmediate); // workaround since Promise.all seems to not let me wait here

            expect(teamsCopy.find((team) => team.name === 'server-1').tabs.find((tab) => tab.name === TAB_PLAYBOOKS).isOpen).toBe(true);
            expect(teamsCopy.find((team) => team.name === 'server-1').tabs.find((tab) => tab.name === TAB_FOCALBOARD).isOpen).toBe(true);
        });

        it('should open only playbooks', async () => {
            ServerInfo.mockReturnValue({promise: {
                name: 'server-1',
                siteURL: 'http://server-1.com',
                serverVersion: '6.0.0',
                hasPlaybooks: true,
                hasFocalboard: false,
            }});

            serverManager.updateServerInfos(teamsCopy);
            await new Promise(setImmediate); // workaround since Promise.all seems to not let me wait here

            expect(teamsCopy.find((team) => team.name === 'server-1').tabs.find((tab) => tab.name === TAB_PLAYBOOKS).isOpen).toBe(true);
            expect(teamsCopy.find((team) => team.name === 'server-1').tabs.find((tab) => tab.name === TAB_FOCALBOARD).isOpen).toBeUndefined();
        });

        it('should open none when server version is too old', async () => {
            ServerInfo.mockReturnValue({promise: {
                name: 'server-1',
                siteURL: 'http://server-1.com',
                serverVersion: '5.0.0',
                hasPlaybooks: true,
                hasFocalboard: true,
            }});

            serverManager.updateServerInfos(teamsCopy);
            await new Promise(setImmediate); // workaround since Promise.all seems to not let me wait here

            expect(teamsCopy.find((team) => team.name === 'server-1').tabs.find((tab) => tab.name === TAB_PLAYBOOKS).isOpen).toBeUndefined();
            expect(teamsCopy.find((team) => team.name === 'server-1').tabs.find((tab) => tab.name === TAB_FOCALBOARD).isOpen).toBeUndefined();
        });

        it('should update server URL using site URL', async () => {
            ServerInfo.mockReturnValue({promise: {
                name: 'server-1',
                siteURL: 'http://server-2.com',
                serverVersion: '6.0.0',
                hasPlaybooks: true,
                hasFocalboard: true,
            }});

            serverManager.updateServerInfos(teamsCopy);
            await new Promise(setImmediate); // workaround since Promise.all seems to not let me wait here

            expect(teamsCopy.find((team) => team.name === 'server-1').url).toBe('http://server-2.com');
        });
    });
});
