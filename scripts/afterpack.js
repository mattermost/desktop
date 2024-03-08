// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const {spawn} = require('child_process');
const path = require('path');

const {flipFuses, FuseVersion, FuseV1Options} = require('@electron/fuses');

const SETUID_PERMISSIONS = '4755';

function fixSetuid(context) {
    return async (target) => {
        if (!['appimage', 'snap'].includes(target.name.toLowerCase())) {
            const result = await spawn('chmod', [SETUID_PERMISSIONS, path.join(context.appOutDir, 'chrome-sandbox')]);
            if (result.code !== 0) {
                throw new Error(
                    `Failed to set proper permissions for linux arch on ${target.name}`,
                );
            }
        }
    };
}

function getAppFileName(context) {
    switch (context.electronPlatformName) {
    case 'win32':
        return 'Mattermost.exe';
    case 'darwin':
    case 'mas':
        return 'Mattermost.app';
    case 'linux':
        return context.packager.executableName;
    default:
        return '';
    }
}

exports.default = async function afterPack(context) {
    try {
        await flipFuses(
            `${context.appOutDir}/${getAppFileName(context)}`, // Returns the path to the electron binary
            {
                version: FuseVersion.V1,
                [FuseV1Options.RunAsNode]: false, // Disables ELECTRON_RUN_AS_NODE
            });

        if (context.electronPlatformName === 'linux') {
            context.targets.forEach(fixSetuid(context));
        }
    } catch (error) {
        console.error('afterPack error: ', error);
        // eslint-disable-next-line no-process-exit
        process.exit(1);
    }
};
