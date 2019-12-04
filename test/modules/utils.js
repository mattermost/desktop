
// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const fs = require('fs');
const path = require('path');

const sourceRootDir = path.join(__dirname, '../..');
const userDataDir = path.join(sourceRootDir, 'test/testUserData/');
const configFilePath = path.join(userDataDir, 'config.json');
const boundsInfoPath = path.join(userDataDir, 'bounds-info.json');
const mattermostURL = 'http://example.com/';

function asyncSleep(timeout) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, timeout);
  });
}

module.exports = {
  asyncSleep,
  sourceRootDir,
  configFilePath,
  userDataDir,
  boundsInfoPath,
  mattermostURL,
  cleanTestConfig() {
    [configFilePath, boundsInfoPath].forEach((file) => {
      try {
        fs.unlinkSync(file);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error(err);
        }
      }
    });
  },

  createTestUserDataDir() {
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir);
    }
  },
};
