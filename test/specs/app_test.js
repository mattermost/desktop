'use strict';

const should = require('should');
const path = require('path');
const fs = require('fs');

const env = require('../modules/environment');

describe('application', function() {
  this.timeout(10000);

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

  afterEach(function() {
    return client.end();
  });

  after(function() {
    chromedriver.kill();
  });

  it('should show settings.html when there is no config file', function() {
    return client
      .init()
      .pause(1000)
      .getUrl().then(function(url) {
        var p = path.parse(url);
        p.base.should.equal('settings.html');
      })
      .end();
  });

  it('should show index.html when there is config file', function() {
    fs.writeFileSync(env.configFilePath, JSON.stringify({
      url: env.mattermostURL
    }));
    return client
      .init()
      .pause(1000)
      .getUrl().then(function(url) {
        var p = path.parse(url);
        p.base.should.equal('index.html');
      })
      .end();
  });

  it('should upgrade v0 config file', function() {
    const settings = require('../../src/common/settings');
    fs.writeFileSync(env.configFilePath, JSON.stringify({
      url: env.mattermostURL
    }));
    return client
      .init()
      .pause(1000)
      .getUrl().then(function(url) {
        var p = path.parse(url);
        p.base.should.equal('index.html');
      })
      .end().then(function() {
        var str = fs.readFileSync(env.configFilePath, 'utf8');
        var config = JSON.parse(str);
        config.version.should.equal(settings.version);
      });
  });
});
