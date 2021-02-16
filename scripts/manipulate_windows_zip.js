// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const spawnSync = require('child_process').spawnSync;

const path = require('path');

const path7za = require('7zip-bin').path7za;

const pkg = require('../package.json');
const appVersion = pkg.version;
const name = pkg.name;

function disableInstallUpdate(zipPath) {
    const zipFullPath = path.resolve(__dirname, '..', zipPath);
    const appUpdaterConfigFile = 'app-updater-config.json';

    const addResult = spawnSync(path7za, ['a', zipFullPath, appUpdaterConfigFile], {cwd: 'resources/windows'});
    if (addResult.status !== 0) {
        throw new Error(`7za a returned non-zero exit code for ${zipPath}`);
    }

    const renameResult = spawnSync(path7za, ['rn', zipFullPath, appUpdaterConfigFile, `resources/${appUpdaterConfigFile}`]);
    if (renameResult.status !== 0) {
        throw new Error(`7za rn returned non-zero exit code for ${zipPath}`);
    }
}

console.log('Manipulating 64-bit zip...');
disableInstallUpdate(`release/${name}-${appVersion}-win-x64.zip`);
console.log('Manipulating 32-bit zip...');
disableInstallUpdate(`release/${name}-${appVersion}-win-ia32.zip`);
