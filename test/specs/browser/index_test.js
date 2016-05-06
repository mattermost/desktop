'use strict';

const should = require('should');
const path = require('path');
const fs = require('fs');

const env = require('../../modules/environment');

describe('browser/index.html', function() {
  this.timeout(10000);

  const config = {
    version: 1,
    teams: [{
      name: 'example_1',
      url: env.mattermostURL + '1'
    }, {
      name: 'example_2',
      url: env.mattermostURL + '2'
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

  it('should NOT show tabs when there is one team', function() {
    fs.writeFileSync(env.configFilePath, JSON.stringify({
      url: env.mattermostURL
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
      .pause(1000)
      .waitForVisible('#mattermostView0', 1000)
      .isVisible('#mattermostView1').then(function(visility) {
        visility.should.be.false();
      })
      .click('#teamTabItem1')
      .pause(1000)
      .waitForVisible('#mattermostView1', 1000)
      .isVisible('#mattermostView0').then(function(visility) {
        visility.should.be.false();
      })
      .end();
  });

  it('should show error when using incorrect URL', function() {
    this.timeout(30000)
    fs.writeFileSync(env.configFilePath, JSON.stringify({
      version: 1,
      teams: [{
        name: 'error_1',
        url: 'http://false'
      }]
    }));
    return client
      .init()
      .waitForVisible('#mattermostView0-fail', 20000)
      .end();
  });
});
