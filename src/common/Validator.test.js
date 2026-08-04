// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import Joi from 'joi';

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
                                name: 'channels',
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
                                name: 'channels',
                                isOpen: true,
                            },
                        ],
                    },
                ],
            });
        });
    });

    describe('validateV4ConfigData', () => {
        const config = {
            autoCheckForUpdates: true,
            autostart: true,
            hideOnStart: false,
            darkMode: false,
            enableHardwareAcceleration: true,
            startInFullscreen: false,
            lastActiveServer: 0,
            logLevel: 'info',
            minimizeToTray: false,
            showTrayIcon: false,
            showUnreadBadge: true,
            skippedVersions: [],
            spellCheckerLocales: ['en-US'],
            spellCheckerURL: 'http://spellcheckerservice.com',
            servers: [
                {
                    name: 'server-1',
                    url: 'http://server-1.com',
                    order: 1,
                },
            ],
            trayIconTheme: 'use_system',
            useSpellChecker: true,
            version: 4,
            viewLimit: 15,
            themeSyncing: true,
            enableMetrics: true,
            enableSentry: true,
            enableSessionAttributes: true,
            useNativeTitleBar: false,
            trustedEmbeddedMediaOrigins: [
                {
                    serverOrigin: 'https://chat.example.com',
                    embeddedOrigin: 'https://meet.example.com',
                },
            ],
        };

        it('should validate v4 config data', () => {
            expect(Validator.validateV4ConfigData(config)).toStrictEqual(config);
        });

        it('should remove invalid spellchecker URLs', () => {
            const modifiedConfig = {
                ...config,
                spellCheckerURL: 'a-bad>url',
            };
            expect(Validator.validateV4ConfigData(modifiedConfig)).not.toHaveProperty('spellCheckerURL');
        });

        it('should reject trusted embedded media values that are not origins', () => {
            const modifiedConfig = {
                ...config,
                trustedEmbeddedMediaOrigins: [
                    {
                        serverOrigin: 'https://chat.example.com/path',
                        embeddedOrigin: 'https://meet.example.com',
                    },
                ],
            };
            expect(Validator.validateV4ConfigData(modifiedConfig)).toBeNull();
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

    describe('ipcValidate', () => {
        const event = {sender: {id: 1}};

        it('calls the underlying handler when every arg matches its schema', () => {
            const handler = jest.fn().mockReturnValue('result');
            const wrapped = Validator.ipcValidate(
                handler,
                [Joi.string().required(), Joi.number().required()],
            );

            expect(wrapped(event, 'hello', 42)).toBe('result');
            expect(handler).toHaveBeenCalledWith(event, 'hello', 42);
        });

        it('drops the call and does not invoke the handler when an arg has the wrong type', () => {
            const handler = jest.fn();
            const wrapped = Validator.ipcValidate(
                handler,
                [Joi.string().required(), Joi.number().required()],
            );

            wrapped(event, 'hello', 1n);
            expect(handler).not.toHaveBeenCalled();
        });

        it('drops the call when a required arg is missing', () => {
            const handler = jest.fn();
            const wrapped = Validator.ipcValidate(
                handler,
                [Joi.string().required(), Joi.number().required()],
            );

            wrapped(event, 'hello');
            expect(handler).not.toHaveBeenCalled();
        });

        it('drops the call when a required object arg is null', () => {
            const handler = jest.fn();
            const wrapped = Validator.ipcValidate(handler, [Joi.object().required()]);

            wrapped(event, null);
            expect(handler).not.toHaveBeenCalled();
        });

        it('allows optional trailing args to be omitted', () => {
            const handler = jest.fn().mockReturnValue('ok');
            const wrapped = Validator.ipcValidate(
                handler,
                [Joi.string().required(), Joi.string(), Joi.string()],
            );

            expect(wrapped(event, 'hello')).toBe('ok');
            expect(handler).toHaveBeenCalledWith(event, 'hello');
        });

        it('passes positional args beyond the schema length through to the handler', () => {
            const handler = jest.fn().mockReturnValue('ok');
            const wrapped = Validator.ipcValidate(handler, [Joi.string().required()]);

            expect(wrapped(event, 'channel', 1n, null, {})).toBe('ok');
            expect(handler).toHaveBeenCalledWith(event, 'channel', 1n, null, {});
        });

        it('invokes the handler when no schemas are provided', () => {
            const handler = jest.fn().mockReturnValue('ok');
            const wrapped = Validator.ipcValidate(handler, []);

            expect(wrapped(event, 'anything', 1n)).toBe('ok');
            expect(handler).toHaveBeenCalledWith(event, 'anything', 1n);
        });

        it('accepts empty strings when schema uses .allow("")', () => {
            const handler = jest.fn().mockReturnValue('ok');
            const wrapped = Validator.ipcValidate(handler, [Joi.string().allow('').required()]);

            expect(wrapped(event, '')).toBe('ok');
            expect(handler).toHaveBeenCalledWith(event, '');
        });

        it('accepts empty strings for all NOTIFY_MENTION-style args', () => {
            const handler = jest.fn().mockReturnValue('ok');
            const mentionSchema = [
                Joi.string().allow('').required(),
                Joi.string().allow('').required(),
                Joi.string().allow('').required(),
                Joi.string().allow('').required(),
                Joi.string().allow('').required(),
                Joi.boolean().required(),
                Joi.string().allow('').required(),
            ];
            const wrapped = Validator.ipcValidate(handler, mentionSchema);

            expect(wrapped(event, 'Title', 'Body', '', '', '', false, '')).toBe('ok');
            expect(handler).toHaveBeenCalledWith(event, 'Title', 'Body', '', '', '', false, '');
        });
    });
});
