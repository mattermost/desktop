// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const fs = require('fs');
const path = require('path');

// For linux dev, drop a desktop shortcut so deep linking works correctly
if (process.platform === 'linux') {
    const xdgDir = path.resolve(process.env.HOME, '.local/share/applications');
    if (fs.existsSync(xdgDir) && !fs.existsSync(path.resolve(xdgDir, 'mattermost-desktop-dev.desktop'))) {
        fs.writeFileSync(
            path.resolve(xdgDir, 'mattermost-desktop-dev.desktop'),
            `[Desktop Entry]
Name=Mattermost.Dev
Exec=${path.resolve(process.cwd(), 'node_modules/electron/dist/electron')} ${path.resolve(process.cwd(), 'dist')} %U
Terminal=false
Type=Application
Icon=mattermost-desktop
StartupWMClass=Mattermost
Comment=Mattermost
MimeType=x-scheme-handler/mattermost-dev;
Categories=contrib/net;
`,
        );

        const defaultsListPath = path.resolve(xdgDir, 'defaults.list');
        if (!fs.existsSync(defaultsListPath)) {
            fs.writeFileSync(defaultsListPath, '[Default Applications]\n');
        }
        fs.appendFileSync(defaultsListPath, 'x-scheme-handler/mattermost-dev=mattermost-desktop-dev.desktop\n');

        const mimeCachePath = path.resolve(xdgDir, 'mimeinfo.cache');
        if (!fs.existsSync(mimeCachePath)) {
            fs.writeFileSync(mimeCachePath, '[MIME Cache]\n');
        }
        fs.appendFileSync(mimeCachePath, 'x-scheme-handler/mattermost-dev=mattermost-desktop-dev.desktop\n');

        console.log('NOTE: You may need to log in and out of your session to ensure that deep linking works correctly.');
    }
}
