// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import * as Validator from './Validator';

describe('common/Validator', () => {
    describe('validateV0ConfigData', () => {
        const config = {url: 'http://server-1.com'};

        it('should return null when not provided object', () => {
            expect(Validator.validateV0ConfigData('notanobject')).toBe(null);
        });

        it('should return complete object when it is valid', () => {
            expect(Validator.validateV0ConfigData(config)).toStrictEqual(config);
        });

        it('should remove fields that arent part of the schema', () => {
            const modifiedConfig = {...config, anotherField: 'value'};
            expect(Validator.validateV0ConfigData(modifiedConfig)).toStrictEqual(config);
        });
    });

    describe('validateV1ConfigData', () => {
        const config = {
            autostart: true,
            enableHardwareAcceleration: true,
            minimizeToTray: false,
            showTrayIcon: false,
            showUnreadBadge: true,
            spellCheckerLocale: 'en-US',
            teams: [
                {
                    name: 'server-1',
                    url: 'http://server-1.com',
                },
            ],
            trayIconTheme: 'light',
            useSpellChecker: true,
            version: 1,
        };

        it('should remove invalid urls', () => {
            const modifiedConfig = {
                ...config,
                teams: [
                    ...config.teams,
                    {
                        name: 'server-2',
                        url: 'a-bad>url',
                    },
                ],
            };
            expect(Validator.validateV1ConfigData(modifiedConfig)).toStrictEqual(config);
        });

        it('should clean URLs with backslashes', () => {
            const modifiedConfig = {
                ...config,
                teams: [
                    ...config.teams,
                    {
                        name: 'server-2',
                        url: 'http:\\\\server-2.com\\subpath',
                    },
                ],
            };
            expect(Validator.validateV1ConfigData(modifiedConfig)).toStrictEqual({
                ...config,
                teams: [
                    ...config.teams,
                    {
                        name: 'server-2',
                        url: 'http://server-2.com/subpath',
                    },
                ],
            });
        });

        it('should invalidate bad spell checker locales', () => {
            const modifiedConfig = {
                ...config,
                spellCheckerLocale: 'not-a-locale',
            };
            expect(Validator.validateV1ConfigData(modifiedConfig)).toStrictEqual(null);
        });
    });

    describe('validateV2ConfigData', () => {
        const config = {
            autostart: true,
            darkMode: false,
            enableHardwareAcceleration: true,
            minimizeToTray: false,
            showTrayIcon: false,
            showUnreadBadge: true,
            spellCheckerLocale: 'en-US',
            spellCheckerURL: 'http://spellcheckerservice.com',
            teams: [
                {
                    name: 'server-1',
                    url: 'http://server-1.com',
                    order: 1,
                },
            ],
            trayIconTheme: 'light',
            useSpellChecker: true,
            version: 2,
        };

        it('should remove invalid spellchecker URLs', () => {
            const modifiedConfig = {
                ...config,
                spellCheckerURL: 'a-bad>url',
            };
            expect(Validator.validateV2ConfigData(modifiedConfig)).not.toHaveProperty('spellCheckerURL');
        });
    });

    describe('validateV3ConfigData', () => {
        const config = {
            autoCheckForUpdates: true,
            autostart: true,
            hideOnStart: false,
            darkMode: false,
            enableHardwareAcceleration: true,
            startInFullscreen: false,
            lastActiveTeam: 0,
            logLevel: 'info',
            minimizeToTray: false,
            showTrayIcon: false,
            showUnreadBadge: true,
            spellCheckerLocales: ['en-US'],
            spellCheckerURL: 'http://spellcheckerservice.com',
            teams: [
                {
                    lastActiveTab: 0,
                    name: 'server-1',
                    url: 'http://server-1.com',
                    order: 1,
                    tabs: [
                        {
                            name: 'tab-1',
                            isOpen: true,
                        },
                    ],
                },
            ],
            trayIconTheme: 'use_system',
            useSpellChecker: true,
            version: 3,
        };

        it('should ensure messaging view is open', () => {
            const modifiedConfig = {
                ...config,
                teams: [
                    {
                        ...config.teams[0],
                        tabs: [
                            ...config.teams[0].tabs,
                            {
                                name: 'TAB_MESSAGING',
                                isOpen: false,
                            },
                        ],
                    },
                ],
            };
            expect(Validator.validateV3ConfigData(modifiedConfig)).toStrictEqual({
                ...config,
                teams: [
                    {
                        ...config.teams[0],
                        tabs: [
                            ...config.teams[0].tabs,
                            {
                                name: 'TAB_MESSAGING',
                                isOpen: true,
                            },
                        ],
                    },
                ],
            });
        });
    });

    describe('validateAllowedProtocols', () => {
        const allowedProtocols = [
            'spotify:',
            'steam:',
            'mattermost:',
        ];

        it('should accept valid protocols', () => {
            expect(Validator.validateAllowedProtocols(allowedProtocols)).toStrictEqual(allowedProtocols);
        });

        it('should reject invalid protocols', () => {
            expect(Validator.validateAllowedProtocols([...allowedProtocols, 'not-a-protocol'])).toStrictEqual(null);
        });
    });
});
