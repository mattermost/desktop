// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const jq = require('node-jq');
const fs = require('fs');

jq.run(
    '.scripts.install = "node-gyp rebuild"',
    './node_modules/macos-notification-state/package.json',
).then((result) => {
    fs.writeFileSync(
        './node_modules/macos-notification-state/package.json',
        result,
    );
});
