// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {systemPreferences} from 'electron';

import {Logger} from 'common/log';
import type {PlatformAppearanceAdapter, PlatformAppearanceRead} from 'main/systemAppearanceMonitor';
import {unsupportedSystemAppearanceAdapter} from 'main/systemAppearanceMonitor';

const APPLE_INTERFACE_STYLE = 'AppleInterfaceStyle';
const APPLE_INTERFACE_THEME_CHANGED = 'AppleInterfaceThemeChangedNotification';
const log = new Logger('SystemAppearanceAdapter');

export function createSystemAppearanceAdapter(): PlatformAppearanceAdapter {
    if (process.platform !== 'darwin') {
        return unsupportedSystemAppearanceAdapter;
    }

    let subscribed = false;
    return {
        read: () => {
            if (!subscribed) {
                return Promise.resolve({status: 'unknown', reason: 'unavailable'});
            }
            return readMacOSAppearance();
        },
        subscribeInvalidation: (invalidate) => {
            try {
                const subscription = systemPreferences.subscribeNotification(APPLE_INTERFACE_THEME_CHANGED, invalidate);
                subscribed = true;
                return () => {
                    subscribed = false;
                    try {
                        systemPreferences.unsubscribeNotification(subscription);
                    } catch (error) {
                        log.warn('Unable to unsubscribe from macOS appearance changes', {error});
                    }
                };
            } catch (error) {
                subscribed = false;
                log.warn('Unable to subscribe to macOS appearance changes', {error});
                return () => undefined;
            }
        },
    };
}

async function readMacOSAppearance(): Promise<PlatformAppearanceRead> {
    try {
        const value: unknown = systemPreferences.getUserDefault(APPLE_INTERFACE_STYLE, 'string');
        if (value === '') {
            return {status: 'known', value: 'light'};
        }
        if (value === 'Dark') {
            return {status: 'known', value: 'dark'};
        }
        return {status: 'unknown', reason: 'invalid'};
    } catch {
        return {status: 'unknown', reason: 'error'};
    }
}
