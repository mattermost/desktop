// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file uses process.exit().
/* eslint-disable no-process-exit */

const {spawn} = require('child_process');

const {path7za} = require('7zip-bin');

const cwd = process.argv[2];

spawn(path7za, ['e', '-y', '*.zip'], {
  cwd,
  stdio: 'inherit',
}).on('error', (err) => {
  console.error(err);
  process.exit(1);
}).on('close', (code) => {
  process.exit(code);
});

/* eslint-enable no-process-exit */
