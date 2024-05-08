// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

var fs = require('fs');
var path = require('path');

exports.default = async function beforePack(context) {
    // The debian packager (fpm) complains when the directory to output the package to doesn't exist
    // So we have to manually create it first
    var dir = path.join(context.outDir, context.packager.appInfo.version)
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, {recursive: true});
    }
};
