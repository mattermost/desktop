// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const {spawnSync} = require('child_process');

const {path7za} = require('7zip-bin');

const windowsZipRegex = /win-[A-Za-z0-9]+\.zip$/g;

async function removeAppUpdate(path) {
    const result = await spawnSync(path7za, ['d', path, 'resources/app-update.yml', '-r']);
    if (result.error) {
        throw new Error(
            `Failed to remove files from ${path}: ${result.error} ${result.stderr} ${result.stdout}`,
        );
    }
}

exports.default = async function afterAllArtifactBuild(context) {
    await context.artifactPaths.forEach(async (path) => {
        if (path.match(windowsZipRegex)) {
            await removeAppUpdate(path);
        }
    });
};
