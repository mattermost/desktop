// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {upgradeV0toV1, upgradeV1toV2, upgradeV2toV3} from 'common/config/upgradePreferences';
import pastDefaultPreferences from 'common/config/pastDefaultPreferences';

jest.mock('common/tabs/TabView', () => ({
    getDefaultTeamWithTabsFromTeam: (value) => ({
        ...value,
        tabs: [
            {
                name: 'tab1',
            },
            {
                name: 'tab2',
            },
        ],
    }),
}));

describe('common/config/upgradePreferences', () => {
    describe('upgradeV0toV1', () => {
        it('should upgrade from v0', () => {
            const config = {url: 'http://server-1.com'};
            expect(upgradeV0toV1(config)).toStrictEqual({
                ...pastDefaultPreferences[1],
                version: 1,
                teams: [
                    {
                        name: 'Primary team',
                        url: config.url,
                    },
                ],
            });
        });
    });
    describe('upgradeV1toV2', () => {
        it('should upgrade from v1', () => {
            const config = {
                version: 1,
                teams: [{
                    name: 'Primary team',
                    url: 'http://server-1.com',
                }, {
                    name: 'Secondary team',
                    url: 'http://server-2.com',
                }],
                showTrayIcon: true,
                trayIconTheme: 'dark',
                minimizeToTray: true,
                notifications: {
                    flashWindow: 2,
                    bounceIcon: true,
                    bounceIconType: 'informational',
                },
                showUnreadBadge: false,
                useSpellChecker: false,
                enableHardwareAcceleration: false,
                autostart: false,
                spellCheckerLocale: 'en-CA',
            };
            expect(upgradeV1toV2(config)).toStrictEqual({
                ...pastDefaultPreferences[2],
                ...config,
                version: 2,
                teams: [{
                    name: 'Primary team',
                    url: 'http://server-1.com',
                    order: 0,
                }, {
                    name: 'Secondary team',
                    url: 'http://server-2.com',
                    order: 1,
                }],
            });
        });
    });
    describe('upgradeV2toV3', () => {
        it('should upgrade from v2', () => {
            const config = {
                version: 2,
                teams: [{
                    name: 'Primary team',
                    url: 'http://server-1.com',
                    order: 0,
                }, {
                    name: 'Secondary team',
                    url: 'http://server-2.com',
                    order: 1,
                }],
                showTrayIcon: true,
                trayIconTheme: 'dark',
                minimizeToTray: true,
                notifications: {
                    flashWindow: 2,
                    bounceIcon: true,
                    bounceIconType: 'informational',
                },
                showUnreadBadge: false,
                useSpellChecker: false,
                enableHardwareAcceleration: false,
                startInFullscreen: false,
                autostart: false,
                hideOnStart: false,
                spellCheckerLocale: 'en-CA',
                darkMode: true,
                downloadLocation: '/some/folder/name',
            };
            expect(upgradeV2toV3(config)).toStrictEqual({
                ...pastDefaultPreferences[3],
                ...config,
                version: 3,
                teams: [{
                    name: 'Primary team',
                    url: 'http://server-1.com',
                    order: 0,
                    tabs: [
                        {
                            name: 'tab1',
                        },
                        {
                            name: 'tab2',
                        },
                    ],
                    lastActiveTab: 0,
                }, {
                    name: 'Secondary team',
                    url: 'http://server-2.com',
                    order: 1,
                    tabs: [
                        {
                            name: 'tab1',
                        },
                        {
                            name: 'tab2',
                        },
                    ],
                    lastActiveTab: 0,
                }],
            });
        });
    });
});
