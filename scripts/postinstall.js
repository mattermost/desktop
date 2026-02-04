// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const {spawnSync} = require('child_process');

const SETUID_PERMISSIONS = '4755';

if (process.platform === 'linux' && !process.env.CI) {
    console.log('Setting proper ownership for linux arch');
    var result = spawnSync('sudo', ['chown', 'root:root', './node_modules/electron/dist/chrome-sandbox']);
    if (result.error) {
        throw new Error(
            `Failed to set proper ownership for linux arch: ${result.error} ${result.stderr} ${result.stdout}`,
        );
    }

    var result = spawnSync('sudo', ['chmod', SETUID_PERMISSIONS, './node_modules/electron/dist/chrome-sandbox']);
    if (result.error) {
        throw new Error(
            `Failed to set proper permissions for linux arch: ${result.error} ${result.stderr} ${result.stdout}`,
        );
    }
}