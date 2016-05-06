'use strict';

const path = require('path');
const webdriverio = require('webdriverio');

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
const config_file_path = path.join(source_root_dir, 'test_config.json');
const mattermost_url = 'http://example.com/team';

var options = {
  host: 'localhost', // Use localhost as chrome driver server
  port: 9515, // "9515" is the port opened by chrome driver.
  desiredCapabilities: {
    browserName: 'chrome',
    chromeOptions: {
      binary: electron_binary_path, // Path to your Electron binary.
      args: ['app=' + path.join(source_root_dir, 'dist'), '--config-file=' + config_file_path] // Optional, perhaps 'app=' + /path/to/your/app/
    }
  }
};

module.exports = {
  sourceRootDir: source_root_dir,
  configFilePath: config_file_path,
  mattermostURL: mattermost_url,
  spawnChromeDriver: function() {
    return require('child_process').spawn('node_modules/chromedriver/lib/chromedriver/chromedriver', ['--url-base=wd/hub', '--port=9515']);
  },
  getWebDriverIoClient: function() {
    return webdriverio.remote(options);
  }
}
