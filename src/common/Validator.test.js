// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import Joi from 'joi';

import * as Validator from './Validator';

describe('common/Validator', () => {
    describe('validateAppState', () => {
        const installId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

        it('should preserve installId so it is not regenerated on every launch', () => {
            expect(Validator.validateAppState({installId})).toStrictEqual({installId});
        });

        it('should preserve installId alongside the other app state fields', () => {
            const state = {lastAppVersion: '6.3.0', installId};
            expect(Validator.validateAppState(state)).toStrictEqual(state);
        });

        it('should not discard sibling state when installId is not a UUID', () => {
            const state = {lastAppVersion: '6.3.0', installId: 'not-a-uuid'};
            expect(Validator.validateAppState(state)).toStrictEqual(state);
        });
    });

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

    describe('server urls in config', () => {
        const plainURL = 'http://server-1.com';
        const keptURLs = [
            plainURL,
            'https://server.example.com',
            'https://internal_host.example',
            'https://[2001:db8::1]/',
            'https://good.example',
            'https://example.com.',
        ];
        const mixedURLs = [
            plainURL,
            'https://a,b.example',
            'https://a;b.example',
            'https://a*.example',
            'https://.example.com',
            'https://a%2A.example',
            'https://a%2C.example',
            'https://a%3B.example',
            'https://%2Eexample.com',
            'https://*',
            'https://,',
            'https://;',
            'https://.',
            'https://example.com,',
            'https://example.com;',
            'https://example.com*',
            'https://ex*ample.com',
            'https://example.com ',
            'https://*,*.example',
            '*,*.example',
            'a,b.example',
            'https://',
            '',
            'https://a\uFF0Ab.example',
            'https://a\uFF0Cb.example',
            'https://a\uFF1Bb.example',
            'https://\u3002example.com',
            'https://A,B.EXAMPLE',
            'https://user:pass@a,b.example',
        ];
        const validators = {
            1: Validator.validateV1ConfigData,
            2: Validator.validateV2ConfigData,
            3: Validator.validateV3ConfigData,
            4: Validator.validateV4ConfigData,
        };

        const configFor = (version, urls) => {
            const servers = urls.map((url, index) => ({name: `server-${index}`, url}));
            if (version === 4) {
                return {version, servers};
            }
            if (version === 3) {
                return {
                    version,
                    teams: servers.map((server) => ({
                        ...server,
                        tabs: [{name: 'channels', isOpen: true}],
                    })),
                };
            }
            return {version, teams: servers};
        };

        const urlsFrom = (result, version) => {
            const servers = version === 4 ? result.servers : result.teams;
            return servers.map((server) => server.url);
        };

        // Checks that each config version keeps a plain https url, an underscore host, and an IPv6 host,
        // and leaves out a hostname containing a comma, semicolon, asterisk, or a leading dot.
        it.each([1, 2, 3, 4].flatMap((version) => [
            {version, kind: 'ordinary server urls', urls: keptURLs, expected: keptURLs},
            {version, kind: 'only ordinary server urls from a mixed list', urls: mixedURLs, expected: [plainURL]},
        ]))('should keep $kind when loading config v$version', ({version, urls, expected}) => {
            const result = validators[version](configFor(version, urls));
            expect(result && urlsFrom(result, version)).toEqual(expected);
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

    describe('desktopSourcesOptsSchema', () => {
        const opts = (thumbnailSize) => ({types: ['screen', 'window'], thumbnailSize});

        it('accepts a typical thumbnail size', () => {
            expect(Validator.desktopSourcesOptsSchema.validate(opts({width: 400, height: 400})).error).toBeUndefined();
        });

        it('rejects oversized thumbnail dimensions', () => {
            expect(Validator.desktopSourcesOptsSchema.validate(opts({width: 1000000, height: 400})).error).toBeDefined();
            expect(Validator.desktopSourcesOptsSchema.validate(opts({width: 400, height: 1000000})).error).toBeDefined();
        });

        it.each([
            -1,
            1.5,
            401,
            4096,
            Number.MAX_SAFE_INTEGER,
        ])('rejects out-of-range or non-integer thumbnail dimension %p', (dim) => {
            expect(Validator.desktopSourcesOptsSchema.validate(opts({width: dim, height: 400})).error).toBeDefined();
            expect(Validator.desktopSourcesOptsSchema.validate(opts({width: 400, height: dim})).error).toBeDefined();
        });

        it('rejects numeric strings as thumbnail dimensions', () => {
            expect(Validator.desktopSourcesOptsSchema.validate(opts({width: '400', height: 400})).error).toBeDefined();
            expect(Validator.desktopSourcesOptsSchema.validate(opts({width: 400, height: '400'})).error).toBeDefined();
        });

        it('accepts the maximum thumbnail dimension', () => {
            expect(Validator.desktopSourcesOptsSchema.validate(opts({width: 400, height: 400})).error).toBeUndefined();
            expect(Validator.desktopSourcesOptsSchema.validate(opts({width: 0, height: 0})).error).toBeUndefined();
        });

        it.each([
            [[]],
            [['screen', 'screen']],
            [['screen', 'window', 'window']],
            [['tab']],
        ])('rejects invalid types %p', (types) => {
            expect(Validator.desktopSourcesOptsSchema.validate({types, thumbnailSize: {width: 400, height: 400}}).error).toBeDefined();
        });

        it.each([
            [['screen']],
            [['window']],
            [['window', 'screen']],
        ])('accepts valid types %p', (types) => {
            expect(Validator.desktopSourcesOptsSchema.validate({types}).error).toBeUndefined();
        });
    });
});
