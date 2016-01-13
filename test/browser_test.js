'use strict';

const webdriverio = require('webdriverio');
const should = require('should');
const path = require('path');
const fs = require('fs');

const source_root_dir = path.join(__dirname, '..');
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
      args: ['app=' + path.join(source_root_dir, 'src'), '--config-file=' + config_file_path] // Optional, perhaps 'app=' + /path/to/your/app/
    }
  }
};

describe('electron-mattermost', function() {
  this.timeout(10000);

  var chromedriver;
  var client;
  before(function(done) {
    chromedriver = require('child_process').spawn('node_modules/chromedriver/lib/chromedriver/chromedriver', ['--url-base=wd/hub', '--port=9515']);
    client = webdriverio.remote(options);

    fs.unlink(config_file_path, function(err) {
      // waiting for chromedriver
      setTimeout(done, 1000);
    });
  });

  afterEach(function() {
    return client.end();
  });

  after(function() {
    chromedriver.kill();
  });

  it('should show settings.html when there is no config file', function() {
    return client
      .init()
      .getUrl().then(function(url) {
        var p = path.parse(url);
        p.base.should.equal('settings.html');
      })
      .end();
  });

  it('should show index.html when there is config file', function() {
    fs.writeFileSync(config_file_path, JSON.stringify({
      url: mattermost_url
    }));
    return client
      .init()
      .getUrl().then(function(url) {
        var p = path.parse(url);
        p.base.should.equal('index.html');
      })
      .end();
  });

  it('should upgrade v0 config file', function() {
    const settings = require('../src/common/settings');
    fs.writeFileSync(config_file_path, JSON.stringify({
      url: mattermost_url
    }));
    return client
      .init()
      .getUrl().then(function(url) {
        var p = path.parse(url);
        p.base.should.equal('index.html');
      })
      .end().then(function() {
        var str = fs.readFileSync(config_file_path, 'utf8');
        var config = JSON.parse(str);
        config.version.should.equal(settings.version);
      });
  });

  describe('index.html', function() {
    const config = {
      version: 1,
      teams: [{
        name: 'example_1',
        url: mattermost_url + '1'
      }, {
        name: 'example_2',
        url: mattermost_url + '2'
      }]
    };

    beforeEach(function() {
      fs.writeFileSync(config_file_path, JSON.stringify(config));
    });

    it('should NOT show tabs when there is one team', function() {
      fs.writeFileSync(config_file_path, JSON.stringify({
        url: mattermost_url
      }));
      return client
        .init()
        .isExisting('#tabBar').then(function(isExisting) {
          isExisting.should.be.false();
        })
        .end();
    });

    it('should set src of webview from config file', function() {
      return client
        .init()
        .getAttribute('#mattermostView0', 'src').then(function(attribute) {
          attribute.should.equal(config.teams[0].url);
        })
        .getAttribute('#mattermostView1', 'src').then(function(attribute) {
          attribute.should.equal(config.teams[1].url);
        })
        .isExisting('#mattermostView2').then(function(isExisting) {
          isExisting.should.be.false();
        })
        .end();
    });

    it('should set name of tab from config file', function() {
      return client
        .init()
        .getText('#teamTabItem0').then(function(text) {
          text.should.equal(config.teams[0].name);
        })
        .getText('#teamTabItem1').then(function(text) {
          text.should.equal(config.teams[1].name);
        })
        .isExisting('#teamTabItem2').then(function(isExisting) {
          isExisting.should.be.false();
        })
        .end();
    });

    it('should show only the selected team', function() {
      return client
        .init()
        .waitForVisible('#mattermostView0')
        .isVisible('#mattermostView1').then(function(visility) {
          visility.should.be.false();
        })
        .click('#teamTabItem1')
        .waitForVisible('#mattermostView1')
        .isVisible('#mattermostView0').then(function(visility) {
          visility.should.be.false();
        })
        .end();
    });
  });

  describe('settings.html', function() {
    const config = {
      version: 1,
      teams: [{
        name: 'example_1',
        url: mattermost_url
      }, {
        name: 'example_2',
        url: mattermost_url
      }]
    };

    before(function() {
      fs.writeFileSync(config_file_path, JSON.stringify(config));
    });

    it('should show index.thml when Cancel button is clicked', function() {
      return client
        .init()
        .url('file://' + path.join(source_root_dir, 'src/browser/settings.html'))
        .waitForExist('#btnCancel')
        .click('#btnCancel')
        .pause(1000)
        .getUrl().then(function(url) {
          var url_split = url.split('/');
          url_split[url_split.length - 1].should.equal('index.html');
        })
        .end();
    });

    it('should show index.thml when Save button is clicked', function() {
      return client
        .init()
        .url('file://' + path.join(source_root_dir, 'src/browser/settings.html'))
        .waitForExist('#btnSave')
        .click('#btnSave')
        .pause(1000)
        .getUrl().then(function(url) {
          var url_split = url.split('/');
          url_split[url_split.length - 1].should.equal('index.html');
        })
        .end();
    });

  });
});
