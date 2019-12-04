// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const path = require('path');

const Application = require('spectron').Application;
const chai = require('chai');

const {
  sourceRootDir,
  configFilePath,
  userDataDir,
  boundsInfoPath,
  mattermostURL,
  cleanTestConfig,
  createTestUserDataDir,
} = require('./utils');
chai.should();

const electronBinaryPath = (() => {
  if (process.platform === 'darwin') {
    return path.join(sourceRootDir, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
  }
  const exeExtension = (process.platform === 'win32') ? '.exe' : '';
  return path.join(sourceRootDir, 'node_modules/electron/dist/electron' + exeExtension);
})();

module.exports = {
  sourceRootDir,
  configFilePath,
  userDataDir,
  boundsInfoPath,
  mattermostURL,
  cleanTestConfig,
  createTestUserDataDir,

  getSpectronApp() {
    const options = {
      path: electronBinaryPath,
      args: [`${path.join(sourceRootDir, 'src')}`, `--data-dir=${userDataDir}`, '--disable-dev-mode'],
      chromeDriverArgs: [],

      // enable this if chromedriver hangs to see logs
      // chromeDriverLogPath: '../chromedriverlog.txt',
    };
    if (process.platform === 'darwin') {
      // on a mac, debbuging port might conflict with other apps
      // this changes the default debugging port so chromedriver can run without issues.
      options.chromeDriverArgs.push('remote-debugging-port=9222');
    }
    return new Application(options);
  },

  addClientCommands(client) {
    client.addCommand('customClick', function async(selector) {
      let selectorString = selector;
      let innerTextString = '';
      const attributeSelectorRegExp = new RegExp(/\[.*=.*\]/);
      const containsEqualsSignRegExp = new RegExp('=');
      const isSelectingByAttribute = selector.match(attributeSelectorRegExp);
      const containsEqualsSign = selector.match(containsEqualsSignRegExp);
      if (containsEqualsSign && !isSelectingByAttribute) {
        selectorString = selector.split('=')[0].trim();
        innerTextString = selector.split('=')[1].trim();
      }
      return this.execute((elementSelector, innerTextQuery) => {
        // TODO: audit for missing edge cases
        let element;
        if (elementSelector && !innerTextQuery) {
          element = document.querySelector(elementSelector);
        } else if (!elementSelector && innerTextQuery) {
          const elements = Array.from(document.all);
          element = elements.find((el) => el.innerText === innerTextQuery);
        } else if (elementSelector && innerTextQuery) {
          const elements = Array.from(document.querySelectorAll(elementSelector));
          element = elements.find((el) => el.innerText === innerTextQuery);
        } else {
          throw new Error('Please pass proper selector query.');
        }
        if (element) {
          element.click();
        } else {
          throw Error(`${elementSelector} not found.`);
        }
      }, selectorString, innerTextString);
    });
    client.addCommand('toggleSettingsPage', function async() {
      return this.browserWindow.send('toggle-settings-page');
    });
    client.addCommand('isNodeEnabled', function async() {
      return this.execute(() => {
        try {
          if (require('child_process')) {
            return true;
          }
          return false;
        } catch (e) {
          return false;
        }
      }).then((requireResult) => {
        return requireResult.value;
      });
    });
    client.addCommand('waitForAppOptionsAutoSaved', function async() {
      const ID_APP_OPTIONS_SAVE_INDICATOR = '#appOptionsSaveIndicator';
      const TIMEOUT = 5000;
      return this.
        waitForVisible(ID_APP_OPTIONS_SAVE_INDICATOR, TIMEOUT).
        waitForVisible(ID_APP_OPTIONS_SAVE_INDICATOR, TIMEOUT, true);
    });
  },

  // execute the test only when `condition` is true
  shouldTest(it, condition) {
    return condition ? it : it.skip;
  },
  isOneOf(platforms) {
    return (platforms.indexOf(process.platform) !== -1);
  },
};
