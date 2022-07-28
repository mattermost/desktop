// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const {exec} = require('child_process');

exports.default = async function beforePack(context) {
    return new Promise((resolve, reject) => {
        const arch = getArch(context.arch);
        exec(`npm run postinstall -- --arch ${arch}`, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
};

function getArch(arch) {
    switch (arch) {
    case 0:
        return 'ia32';
    case 1:
        return 'x64';
    case 2:
        return 'armv7l';
    case 3:
        return 'arm64';
    case 4:
        return 'universal';
    default:
        return '';
    }
}
