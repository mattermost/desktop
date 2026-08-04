// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const fs = require('fs');
const path = require('path');

const {Arch} = require('electron-builder');
const pacote = require('pacote');

const {dependencies} = require('../package.json');

const rootDir = path.join(__dirname, '..');

// koffi ships its prebuilt native binaries as separate @koromix/koffi-{platform}-{arch}
// optionalDependencies. npm's install-time platform gate only installs the one matching
// the current host's os/cpu, so cross-building for a different target leaves that
// target's package missing from node_modules. pacote.extract fetches the package by spec
// straight from the registry, bypassing the gate entirely (no install-resolution involved).
async function ensureKoffiBinary(context) {
    // electron-builder reports the MAS target as platform "mas", but koffi (like Node)
    // only knows about "darwin" since MAS doesn't change process.platform at runtime.
    const platform = context.electronPlatformName === 'mas' ? 'darwin' : context.electronPlatformName;
    const arch = Arch[context.arch];
    const packageName = `@koromix/koffi-${platform}-${arch}`;
    const destDir = path.join(rootDir, 'node_modules/@koromix', `koffi-${platform}-${arch}`);

    // Idempotent: this can run once per target in a single CI job packaging multiple
    // targets, so skip refetching when the package is already extracted.
    if (fs.existsSync(destDir)) {
        return;
    }

    try {
        await pacote.extract(`${packageName}@${dependencies.koffi}`, destDir);
    } catch (error) {
        // pacote creates destDir before fetching, so remove the partial/empty dir on
        // failure to stop the existence check above from treating it as already installed.
        fs.rmSync(destDir, {recursive: true, force: true});
        throw new Error(`Failed to fetch ${packageName}@${dependencies.koffi}: ${error.message}`);
    }
}

exports.default = async function beforePack(context) {
    await ensureKoffiBinary(context);

    // The debian packager (fpm) complains when the directory to output the package to doesn't exist
    // So we have to manually create it first
    const dir = path.join(context.outDir, context.packager.appInfo.version);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
    }
};
