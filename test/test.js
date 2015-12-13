const webdriverio = require('webdriverio');
const should = require('should');
const path = require('path');
const fs = require('fs');

const exe_extension = (process.platform === 'win32') ? ".exe" : "";
const source_root_dir = path.join(__dirname, '..');
const electron_binary_path = path.join(source_root_dir, 'node_modules/electron-prebuilt/dist/electron' + exe_extension);
const config_file_path = path.join(source_root_dir, 'test_config.json');
const mattermost_url = 'http://example.com/team';

var chromedriver = require('child_process').spawn('node_modules/chromedriver/lib/chromedriver/chromedriver', ['--url-base=wd/hub', '--port=9515']);

var options = {
  host: "localhost", // Use localhost as chrome driver server
  port: 9515, // "9515" is the port opened by chrome driver.
  desiredCapabilities: {
    browserName: 'chrome',
    chromeOptions: {
      binary: electron_binary_path, // Path to your Electron binary.
      args: ['app=' + path.join(source_root_dir, 'src'), '--config-file=' + config_file_path] // Optional, perhaps 'app=' + /path/to/your/app/
    }
  }
};

describe('electron-mattermost', function() {
  before(function(done) {
    fs.unlink(config_file_path, function(err) {
      done();
    });
  });

  it('should show settings.html when there is no config file', function(done) {
    var client = webdriverio.remote(options);
    client
      .init()
      .getUrl().then(function(url) {
        var p = path.parse(url);
        p.base.should.equal('settings.html');
      })
      .end().then(function() {
        done();
      });
  });

  it('should show index.html when there is config file', function(done) {
    fs.writeFileSync(config_file_path, JSON.stringify({
      url: mattermost_url
    }));
    var client = webdriverio.remote(options);
    client
      .init()
      .getUrl().then(function(url) {
        var p = path.parse(url);
        p.base.should.equal('index.html');
      })
      .end().then(function() {
        done();
      });
  });

  describe('index.html', function() {
    before(function() {
      fs.writeFileSync(config_file_path, JSON.stringify({
        url: mattermost_url
      }));
    });

    it('should set src of #mainWebview from config file', function(done) {
      var client = webdriverio.remote(options);
      client
        .init()
        .getAttribute('#mainWebview', 'src').then(function(attribute) {
          attribute.should.equal(mattermost_url);
        })
        .end().then(function() {
          done();
        });
    });
  });
});
