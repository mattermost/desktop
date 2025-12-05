// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
}));

jest.mock('common/config', () => ({
    enableSentry: true,
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

    describe('captureException', () => {
        beforeEach(() => {
            process.env = {NODE_ENV: 'production'};
            sentryHandler.init();
        });

        it('should capture exception when initialized and enabled', () => {
            const error = new Error('Test error');
            sentryHandler.captureException(error);
            expect(Sentry.captureException).toHaveBeenCalledWith(error);
        });

        it('should not capture exception if not initialized', () => {
            const uninitializedHandler = new SentryHandler();
            const error = new Error('Test error');
            uninitializedHandler.captureException(error);
            expect(Sentry.captureException).not.toHaveBeenCalled();
        });

        it('should not capture exception if NODE_ENV is not production', () => {
            process.env = {NODE_ENV: 'development'};
            const error = new Error('Test error');
            sentryHandler.captureException(error);
            expect(Sentry.captureException).not.toHaveBeenCalled();
        });

        it('should not capture exception if enableSentry is false', () => {
            Config.enableSentry = false;
            const error = new Error('Test error');
            sentryHandler.captureException(error);
            expect(Sentry.captureException).not.toHaveBeenCalled();
            Config.enableSentry = true;
        });

        it('should handle missing error argument', () => {
            sentryHandler.captureException(null);

            expect(Sentry.captureException).not.toHaveBeenCalled();
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

