// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const {spawnSync} = require('child_process');
const path = require('path');

const {flipFuses, FuseVersion, FuseV1Options} = require('@electron/fuses');

const SETUID_PERMISSIONS = '4755';

function fixSetuid(context) {
    return async (target) => {
        if (!['appimage', 'snap'].includes(target.name.toLowerCase())) {
            const result = await spawnSync('chmod', [SETUID_PERMISSIONS, path.join(context.appOutDir, 'chrome-sandbox')]);
            if (result.error) {
                throw new Error(
                    `Failed to set proper permissions for linux arch on ${target.name}: ${result.error} ${result.stderr} ${result.stdout}`,
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
                [FuseV1Options.EnableNodeCliInspectArguments]: false, // Disables --inspect
                [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
                [FuseV1Options.EnableCookieEncryption]: true,
                [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false, // Disables NODE_OPTIONS and NODE_EXTRA_CA_CERTS
                // Can only verify on macOS right now, electron-builder doesn't support Windows ASAR integrity verification
                [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: context.electronPlatformName === 'darwin' || context.electronPlatformName === 'mas',
                [FuseV1Options.OnlyLoadAppFromAsar]: true,
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
