// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// inspired by https://kilianvalkhof.com/2019/electron/notarizing-your-electron-application/
require('dotenv').config();
const {notarize} = require('electron-notarize');

const config = require('../electron-builder.json');

exports.default = async function notarizing(context) {
  const {electronPlatformName, appOutDir} = context;
  if (electronPlatformName !== 'darwin' || process.platform !== 'darwin') {
    console.log('Skipping notarization, either it is not a mac app or we are not running on a osx machine');
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  console.log(`Notarizing ${appName}, if everything goes well, elias will receive an email about it`);
  await notarize({
    appBundleId: config.appId,
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLEID,
    appleIdPassword: process.env.APPLEIDPASS,
  });
};