// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app} from 'electron';

import MainWindow from 'app/mainWindow/mainWindow';
import Config from 'common/config';

/** Mirrors notifications/index.ts flashFrame — E2E only. */
export function triggerNotificationFrameEffects(flash: boolean) {
    if (process.platform === 'linux' || process.platform === 'win32') {
        if (Config.notifications.flashWindow) {
            MainWindow.get()?.flashFrame(flash);
        }
    }
    if (process.platform === 'darwin' && Config.notifications.bounceIcon && Config.notifications.bounceIconType) {
        app.dock?.bounce(Config.notifications.bounceIconType);
    }
}
