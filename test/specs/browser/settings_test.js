'use strict';

const should = require('should');
const path = require('path');
const fs = require('fs');

const env = require('../../modules/environment');

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
    return client.init()
      .url('file://' + path.join(env.sourceRootDir, 'dist/browser/settings.html'))
  });

  afterEach(function() {
    return client.end();
  });

  after(function() {
    chromedriver.kill();
  });

  it('should show index.thml when Cancel button is clicked', function() {
    return client
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
