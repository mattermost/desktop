'use strict';

const should = require('should');
const path = require('path');
const fs = require('fs');

const env = require('../../modules/environment');

function initClient(client) {
  return client
    .init()
    .url('file://' + path.join(env.sourceRootDir, 'dist/browser/settings.html'));
}

describe('browser/settings.html', function() {
  this.timeout(10000);

  const config = {
    version: 1,
    teams: [{
      name: 'example_1',
      url: env.mattermostURL
    }, {
      name: 'example_2',
      url: env.mattermostURL
    }]
  };

  var chromedriver;
  var client;
  before(function(done) {
    chromedriver = env.spawnChromeDriver();
    client = env.getWebDriverIoClient();

    fs.unlink(env.configFilePath, function(err) {
      // waiting for chromedriver
      setTimeout(done, 1000);
    });
  });

  beforeEach(function() {
    fs.writeFileSync(env.configFilePath, JSON.stringify(config));
  });

  afterEach(function() {
    return client.end();
  });

  after(function() {
    chromedriver.kill();
  });

  it('should show index.thml when Cancel button is clicked', function() {
    return initClient(client)
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
    return initClient(client)
      .waitForExist('#btnSave')
      .click('#btnSave')
      .pause(1000)
      .getUrl().then(function(url) {
        var url_split = url.split('/');
        url_split[url_split.length - 1].should.equal('index.html');
      })
      .end();
  });

  describe('Options', function() {
    describe('Hide Menu Bar', function() {
      it('should appear on win32 or linux', function() {
        return initClient(client)
          .isExisting('#inputHideMenuBar').then(function(isExisting) {
            if (process.platform === 'win32' || process.platform === 'linux') {
              isExisting.should.be.true();
            }
            else {
              isExisting.should.be.false();
            }
          })
          .end();
      });

      if (process.platform === 'win32' || process.platform === 'linux') {
        [true, false].forEach(function(v) {
          it(`should be loaded from config: ${v}`, function() {
            var new_config = {};
            Object.assign(new_config, config);
            new_config.hideMenuBar = v;
            fs.writeFileSync(env.configFilePath, JSON.stringify(new_config));
            return initClient(client)
              .isSelected('#inputHideMenuBar input').then(function(value) {
                value.should.equal(v);
              })
              .end();
          });
        });

        it('should be saved as config.json', function() {
          return initClient(client)
            .click('#inputHideMenuBar input')
            .click('#btnSave')
            .pause(1000)
            .then(function() {
              const saved_config = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
              saved_config.hideMenuBar.should.be.true();
            })
            .end();
        });
      }
    });
  });
});
