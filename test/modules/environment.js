'use strict';

const chai = require('chai');
chai.should();

const fs = require('fs');
const path = require('path');
const Application = require('spectron').Application;

const sourceRootDir = path.join(__dirname, '../..');
const electronBinaryPath = (() => {
  if (process.platform === 'darwin') {
    return path.join(sourceRootDir, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
  }
  const exeExtension = (process.platform === 'win32') ? '.exe' : '';
  return path.join(sourceRootDir, 'node_modules/electron/dist/electron' + exeExtension);
})();
const userDataDir = path.join(sourceRootDir, 'test/testUserData/');
const configFilePath = path.join(userDataDir, 'config.json');
const boundsInfoPath = path.join(userDataDir, 'bounds-info.json');
const mattermostURL = 'http://example.com/team';

module.exports = {
  sourceRootDir,
  configFilePath,
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

  getSpectronApp() {
    return new Application({
      path: electronBinaryPath,
      args: [`${path.join(sourceRootDir, 'src')}`, `--data-dir=${userDataDir}`, '--disable-dev-mode']
    });
  },

  addClientCommands(client) {
    client.addCommand('loadSettingsPage', function async() {
      return this.url('file://' + path.join(sourceRootDir, 'src/browser/settings.html')).waitUntilWindowLoaded();
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
  },

  // execute the test only when `condition` is true
  shouldTest(it, condition) {
    return condition ? it : it.skip;
  },
  isOneOf(platforms) {
    return (platforms.indexOf(process.platform) !== -1);
  }
};
