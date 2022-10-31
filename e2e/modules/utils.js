// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
const fs = require('fs');

function asyncSleep(timeout) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, timeout);
    });
}

function dirExistsAsync(path) {
    return new Promise((resolve, reject) => {
        fs.stat(path, (error, stats) => {
            if (error) {
                if (error.code === 'ENOENT') {
                    resolve(false);
                } else {
                    reject(error);
                }
                return;
            }
            resolve(stats.isDirectory());
        });
    });
}

function mkDirAsync(path) {
    return new Promise((resolve, reject) => {
        dirExistsAsync(path).then((exists) => {
            if (exists) {
                resolve();
                return;
            }
            fs.mkdir(path, {recursive: true}, (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        }).catch((err) => {
            reject(err);
        });
    });
}

function rmDirAsync(path) {
    return new Promise((resolve, reject) => {
        dirExistsAsync(path).then((exists) => {
            if (exists) {
                fs.rm(path, {recursive: true, force: true}, (error) => {
                    if (error) {
                        if (error.code === 'ENOENT') {
                            resolve();
                        }
                        reject(error);
                    }
                    resolve();
                });
            }
            resolve();
        }).catch((err) => {
            reject(err);
        });
    });
}

function unlinkAsync(path) {
    return new Promise((resolve, reject) => {
        fs.unlink(path, (error) => {
            if (error) {
                if (error.code === 'ENOENT') {
                    resolve();
                }
                reject(error);
            }
            resolve();
        });
    });
}

function writeFileAsync(path, data) {
    return new Promise((resolve, reject) => {
        fs.writeFile(path, data, (err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}

module.exports = {
    asyncSleep,
    dirExistsAsync,
    mkDirAsync,
    rmDirAsync,
    unlinkAsync,
    writeFileAsync,
};
