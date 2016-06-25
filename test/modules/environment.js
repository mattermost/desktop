'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.should();
chai.use(chaiAsPromised);


const path = require('path');
const Application = require('spectron').Application;

const source_root_dir = path.join(__dirname, '../..');
const electron_binary_path = (function() {
  if (process.platform === 'darwin') {
    return path.join(source_root_dir, 'node_modules/electron-prebuilt/dist/Electron.app/Contents/MacOS/Electron');
  }
  else {
    const exe_extension = (process.platform === 'win32') ? '.exe' : '';
    return path.join(source_root_dir, 'node_modules/electron-prebuilt/dist/electron' + exe_extension);
  }
})();
const config_file_path = path.join(source_root_dir, 'test/test_config.json');
const mattermost_url = 'http://example.com/team';

module.exports = {
  sourceRootDir: source_root_dir,
  configFilePath: config_file_path,
  mattermostURL: mattermost_url,
  getSpectronApp: function() {
    const app = new Application({
      path: electron_binary_path,
      args: [`${path.join(source_root_dir, 'dist')}`, '--config-file=' + config_file_path]
    });
    chaiAsPromised.transferPromiseness = app.transferPromiseness
    return app;
  },

  addClientCommands: function(client) {
    client.addCommand('loadSettingsPage', function async() {
      return this
        .url('file://' + path.join(source_root_dir, 'dist/browser/settings.html'))
        .waitUntilWindowLoaded();
    });
    client.addCommand('isNodeEnabled', function async() {
      return this.execute(function() {
        try {
          return require('child_process') ? true : false;
        }
        catch (e) {
          return false;
        }
      }).then((require_result) => {
        return require_result.value;
      });
    });
  },

  // execute the test only when `condition` is true
  shouldTest: function(it, condition) {
    return condition ? it : it.skip;
  },
  isOneOf(platforms) {
    return (platforms.indexOf(process.platform) !== -1);
  }
}
