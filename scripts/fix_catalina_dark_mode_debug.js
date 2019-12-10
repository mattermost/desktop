// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const {exec} = require('child_process');

if (process.platform === 'darwin') {
  exec('plutil -insert NSRequiresAquaSystemAppearance -bool NO ./node_modules/electron/dist/Electron.app/Contents/Info.plist', (err) => {
    if (err) {
      console.error(err);
    }
  });
}

