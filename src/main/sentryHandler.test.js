// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import os from 'os';

import * as Sentry from '@sentry/electron/main';
import {app} from 'electron';

import Config from 'common/config';

import {SentryHandler} from './sentryHandler';

jest.mock('@sentry/electron/main', () => ({
    __esModule: true,
    init: jest.fn(),
    captureException: jest.fn(),
    setContext: jest.fn(),
}));

jest.mock('electron', () => ({
    app: {
        getName: jest.fn(() => 'Mattermost'),
        getVersion: jest.fn(() => '6.0.0'),
    },
}));

jest.mock('os', () => ({
    type: jest.fn(() => 'Darwin'),
    release: jest.fn(() => '21.0.0'),
    arch: jest.fn(() => 'x64'),
    cpus: jest.fn(() => [{}, {}, {}, {}]),
    totalmem: jest.fn(() => 8589934592),
    freemem: jest.fn(() => 4294967296),
    homedir: jest.fn(() => '/Users/jane'),
}));

jest.mock('common/config', () => ({
    enableSentry: true,
}));

const mockInstallId = jest.fn();

jest.mock('main/AppVersionManager', () => ({
    __esModule: true,
    default: {
        get installId() {
            return mockInstallId();
        },
    },
}));

describe('main/sentryHandler', () => {
    let sentryHandler;
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        sentryHandler = new SentryHandler();
        Object.defineProperty(process, 'versions', {
            value: {
                electron: '20.0.0',
                node: '18.0.0',
            },
            writable: true,
            configurable: true,
        });
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('init', () => {
        beforeEach(() => {
            process.env = {NODE_ENV: 'production'};
            app.getVersion.mockReturnValue('6.0.0');
        });

        it('should initialize Sentry when conditions are met', () => {
            sentryHandler.init();
            expect(Sentry.init).toHaveBeenCalledWith(
                expect.objectContaining({
                    dsn: 'https://test@sentry.io/123',
                    sendDefaultPii: false,
                    environment: 'stable',
                    attachStacktrace: true,
                }),
            );
            expect(Sentry.setContext).toHaveBeenCalled();
        });

        it('should not initialize if NODE_ENV is not production', () => {
            process.env = {NODE_ENV: 'development'};
            sentryHandler.init();
            expect(Sentry.init).not.toHaveBeenCalled();
        });

        it('should not initialize if enableSentry is false', () => {
            Config.enableSentry = false;
            sentryHandler.init();
            expect(Sentry.init).not.toHaveBeenCalled();
            Config.enableSentry = true;
        });

        it('should configure prerelease build settings when version has prerelease', () => {
            app.getVersion.mockReturnValue('6.0.0-develop.1');
            sentryHandler.init();
            expect(Sentry.init).toHaveBeenCalledWith(
                expect.objectContaining({
                    environment: 'prerelease',
                    attachStacktrace: true,
                }),
            );
        });

        it('should add context information on initialization', () => {
            app.getVersion.mockReturnValue('6.0.0');
            sentryHandler.init();
            expect(Sentry.setContext).toHaveBeenCalledWith(
                'App-Build Information',
                expect.objectContaining({
                    appName: 'Mattermost',
                    appVersion: '6.0.0',
                    electronVersion: '20.0.0',
                }),
            );
            expect(Sentry.setContext).toHaveBeenCalledWith(
                'Platform Information',
                expect.objectContaining({
                    platform: expect.any(String),
                    platformRelease: '21.0.0',
                    arch: 'x64',
                    totalMemory: 8589934592,
                    freeMemory: 4294967296,
                }),
            );
        });
    });

    describe('install ID attribution', () => {
        beforeEach(() => {
            process.env = {NODE_ENV: 'production'};
            app.getVersion.mockReturnValue('6.0.0');
            mockInstallId.mockReturnValue('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
        });

        it('should attach the install ID as the Sentry user via initialScope', () => {
            sentryHandler.init();
            expect(Sentry.init).toHaveBeenCalledWith(
                expect.objectContaining({
                    initialScope: {user: {id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'}},
                }),
            );
        });

        it('should not send email or username alongside the install ID', () => {
            sentryHandler.init();
            const {initialScope} = Sentry.init.mock.calls[0][0];
            expect(Object.keys(initialScope.user)).toEqual(['id']);
        });

        it('should still initialize Sentry when no install ID is available', () => {
            mockInstallId.mockReturnValue(undefined);

            sentryHandler.init();

            expect(Sentry.init).toHaveBeenCalledWith(
                expect.objectContaining({dsn: 'https://test@sentry.io/123'}),
            );
            expect(Sentry.init.mock.calls[0][0]).not.toHaveProperty('initialScope');
        });
    });

    describe('home directory scrubbing', () => {
        let beforeSend;

        beforeEach(() => {
            process.env = {NODE_ENV: 'production'};
            Sentry.init.mockImplementation((options) => {
                beforeSend = options.beforeSend;
            });
            sentryHandler.init();
        });

        afterEach(() => {
            os.homedir.mockReturnValue('/Users/jane');
        });

        it('should scrub the home directory from messages and exception values', () => {
            const event = beforeSend({
                message: 'Failed to read /Users/jane/Downloads/file.pdf',
                exception: {values: [{value: "ENOENT: no such file or directory, open '/Users/jane/Downloads/file.pdf'"}]},
            });
            expect(event.message).toBe('Failed to read ~/Downloads/file.pdf');
            expect(event.exception.values[0].value).toBe("ENOENT: no such file or directory, open '~/Downloads/file.pdf'");
        });

        it('should scrub the home directory from breadcrumbs', () => {
            const event = beforeSend({
                breadcrumbs: [{
                    message: 'Saved to /Users/jane/Downloads/file.pdf',
                    data: {arguments: ['Saved to', {path: '/Users/jane/Downloads/file.pdf'}]},
                }],
            });
            expect(event.breadcrumbs[0]).toEqual({
                message: 'Saved to ~/Downloads/file.pdf',
                data: {arguments: ['Saved to', {path: '~/Downloads/file.pdf'}]},
            });
        });

        it('should scrub Windows home directories with either separator', () => {
            os.homedir.mockReturnValue('C:\\Users\\jane');
            const event = beforeSend({
                exception: {values: [{value: 'Failed to load file:///C:/Users/jane/file.pdf from C:\\Users\\jane\\file.pdf'}]},
                breadcrumbs: [{data: {path: 'C:\\Users\\jane\\file.pdf'}}],
            });
            expect(event.exception.values[0].value).toBe('Failed to load file:///~/file.pdf from ~\\file.pdf');
            expect(event.breadcrumbs[0].data).toEqual({path: '~\\file.pdf'});
        });
    });

    describe('isPrereleaseBuild', () => {
        beforeEach(() => {
            process.env = {NODE_ENV: 'production'};
        });

        it('should detect prerelease build from prerelease version', () => {
            app.getVersion.mockReturnValue('6.0.0-develop.1');
            sentryHandler.init();
            expect(Sentry.init).toHaveBeenCalledWith(
                expect.objectContaining({
                    environment: 'prerelease',
                }),
            );
        });

        it('should detect stable build from release version', () => {
            app.getVersion.mockReturnValue('6.0.0');
            sentryHandler.init();
            expect(Sentry.init).toHaveBeenCalledWith(
                expect.objectContaining({
                    environment: 'stable',
                }),
            );
        });
    });
});

