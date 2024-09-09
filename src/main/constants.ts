// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* istanbul ignore file */

import path from 'path';

import {app, ipcMain} from 'electron';

import {UPDATE_PATHS} from 'common/communication';

let userDataPath;

export let configPath = '';
export let allowedProtocolFile = '';
export let appVersionJson = '';
export let certificateStorePath = '';
export let trustedOriginsStoreFile = '';
export let boundsInfoPath = '';
export let migrationInfoPath = '';
export let downloadsJson = '';
export let permissionsJson = '';
export let developerModeJson = '';

export function updatePaths(emit = false) {
    userDataPath = app.getPath('userData');

    configPath = `${userDataPath}/config.json`;
    allowedProtocolFile = path.resolve(userDataPath, 'allowedProtocols.json');
    appVersionJson = path.join(userDataPath, 'app-state.json');
    certificateStorePath = path.resolve(userDataPath, 'certificate.json');
    trustedOriginsStoreFile = path.resolve(userDataPath, 'trustedOrigins.json');
    boundsInfoPath = path.join(userDataPath, 'bounds-info.json');
    migrationInfoPath = path.resolve(userDataPath, 'migration-info.json');
    downloadsJson = path.resolve(userDataPath, 'downloads.json');
    permissionsJson = path.resolve(userDataPath, 'permissions.json');
    developerModeJson = path.resolve(userDataPath, 'developerMode.json');

    if (emit) {
        ipcMain.emit(UPDATE_PATHS);
    }
}

updatePaths();
