// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import AutoLaunch from 'auto-launch';
import {app} from 'electron';

function shouldQuitApp(cmd) {
  if (process.platform !== 'win32') {
    return false;
  }
  const squirrelCommands = ['--squirrel-install', '--squirrel-updated', '--squirrel-uninstall', '--squirrel-obsolete'];
  return squirrelCommands.includes(cmd);
}

async function setupAutoLaunch(cmd) {
  const appLauncher = new AutoLaunch({
    name: app.getName(),
    isHidden: true,
  });
  if (cmd === '--squirrel-uninstall') {
    // If we're uninstalling, make sure we also delete our auto launch registry key
    await appLauncher.disable();
  } else if (cmd === '--squirrel-install' || cmd === '--squirrel-updated') {
    // If we're updating and already have an registry entry for auto launch, make sure to update the path
    const enabled = await appLauncher.isEnabled();
    if (enabled) {
      await appLauncher.enable();
    }
  }
}

export default function squirrelStartup(callback) {
  if (process.platform === 'win32') {
    const cmd = process.argv[1];
    setupAutoLaunch(cmd).then(() => {
      if (require('electron-squirrel-startup') && callback) { // eslint-disable-line global-require
        callback();
      }
    });
    return shouldQuitApp(cmd);
  }
  return false;
}
