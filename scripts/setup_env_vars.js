// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
const {exec} = require('child_process');

if (process.platform === 'win32') {
  console.log('setting up windows environment variables');
  exec('./scripts/setup_env_vars.ps1');
}