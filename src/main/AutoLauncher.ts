// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import AutoLaunch from 'auto-launch';
import {app} from 'electron';
import isDev from 'electron-is-dev';

import {Logger} from 'common/log';

const log = new Logger('AutoLauncher');

export class AutoLauncher {
    appLauncher: AutoLaunch;

    constructor() {
        this.appLauncher = new AutoLaunch({
            name: app.name,
            isHidden: true,
        });
    }

    async upgradeAutoLaunch() {
        if (process.platform === 'darwin') {
            return;
        }
        const appLauncher = new AutoLaunch({
            name: app.name,
        });
        const enabled = await appLauncher.isEnabled();
        if (enabled) {
            await appLauncher.enable();
        }
    }

    isEnabled() {
        return this.appLauncher.isEnabled();
    }

    async enable() {
        if (isDev) {
            log.warn('In development mode, autostart config never effects');
            return Promise.resolve(null);
        }
        const enabled = await this.isEnabled();
        if (!enabled) {
            return this.appLauncher.enable();
        }
        return Promise.resolve(null);
    }

    async disable() {
        if (isDev) {
            log.warn('In development mode, autostart config never effects');
            return Promise.resolve(null);
        }
        const enabled = await this.isEnabled();
        if (enabled) {
            return this.appLauncher.disable();
        }
        return Promise.resolve(null);
    }
}

const autoLauncher = new AutoLauncher();
export default autoLauncher;
