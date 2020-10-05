// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import AutoLaunch from 'auto-launch';

async function upgradeAutoLaunch() {
  if (process.platform === 'darwin') {
    return;
  }
  const appLauncher = new AutoLaunch({
    name: 'Mattermost',
  });
  const enabled = await appLauncher.isEnabled();
  if (enabled) {
    await appLauncher.enable();
  }
}

export default upgradeAutoLaunch;
