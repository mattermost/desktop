// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import os from 'os';

import * as Sentry from '@sentry/electron/main';
import {app} from 'electron';

import Config from 'common/config';
import {Logger} from 'common/log';

const log = new Logger('SentryHandler');

export class SentryHandler {
    private sentryInitialized = false;

    init = () => {
        if (!this.shouldSendToSentry()) {
            return;
        }

        // eslint-disable-next-line no-undef
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const sentryDsn = __SENTRY_DSN__;
        if (!sentryDsn || typeof sentryDsn !== 'string' || sentryDsn.length === 0) {
            log.warn('Sentry is enabled, but not configured (no DSN provided)');
            return;
        }

        const isPrerelease = this.isPrereleaseBuild();
        Sentry.init({
            dsn: sentryDsn,
            sendDefaultPii: false,
            environment: isPrerelease ? 'prerelease' : 'stable',
            attachStacktrace: true,
        });

        this.addSentryContext();
        this.sentryInitialized = true;
        log.info('Sentry initialized for error tracking', {isPrerelease});
    };

    captureException = (error: Error) => {
        if (!this.shouldSendToSentry() || !this.sentryInitialized) {
            return;
        }

        if (!error) {
            log.warn('captureException called with missing arguments', error);
            return;
        }

        Sentry.captureException(error);
    };

    private addSentryContext = () => {
        if (!this.shouldSendToSentry()) {
            return;
        }

        try {
            Sentry.setContext('App-Build Information', {
                appName: app.getName(),
                appVersion: app.getVersion(),
                electronVersion: process.versions.electron,

                // eslint-disable-next-line no-undef
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                macAppStore: __IS_MAC_APP_STORE__,
            });

            Sentry.setContext('Platform Information', {
                platform: process.platform,
                platformRelease: os.release(),
                arch: os.arch(),
                totalMemory: os.totalmem(),
                freeMemory: os.freemem(),
            });
        } catch (e) {
            log.error('Failed to add Sentry context', {e});
        }
    };

    private isPrereleaseBuild = (): boolean => {
        const version = app.getVersion();
        const prereleasePattern = /-[a-zA-Z0-9.-]+/;
        return prereleasePattern.test(version);
    };

    private shouldSendToSentry = (): boolean => {
        return process.env.NODE_ENV === 'production' && Config.enableSentry;
    };
}

const sentryHandler = new SentryHandler();
export default sentryHandler;

