'use strict';

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

  beforeEach(function() {
    fs.writeFileSync(env.configFilePath, JSON.stringify(config));
    this.app = env.getSpectronApp();
    return this.app.start();
  });

  afterEach(function() {
    if (this.app && this.app.isRunning()) {
      return this.app.stop()
    }
  });

  it('should NOT show tabs when there is one team', function() {
    fs.writeFileSync(env.configFilePath, JSON.stringify({
      url: env.mattermostURL
    }));
    return this.app.restart().then(() => {
      return this.app.client.waitUntilWindowLoaded()
        .isExisting('#tabBar').should.eventually.be.false
    });
  });

  it('should set src of webview from config file', function() {
    return this.app.client.waitUntilWindowLoaded()
      .getAttribute('#mattermostView0', 'src').should.eventually.equal(config.teams[0].url)
      .getAttribute('#mattermostView1', 'src').should.eventually.equal(config.teams[1].url)
      .isExisting('#mattermostView2').should.eventually.be.false
  });

  it('should set name of tab from config file', function() {
    return this.app.client.waitUntilWindowLoaded()
      .getText('#teamTabItem0').should.eventually.equal(config.teams[0].name)
      .getText('#teamTabItem1').should.eventually.equal(config.teams[1].name)
  });

  it('should show only the selected team', function() {
    return this.app.client.waitUntilWindowLoaded()
      .isVisible('#mattermostView0').should.eventually.be.true
      .isVisible('#mattermostView1').should.eventually.be.false
      .click('#teamTabItem1')
      .pause(1000)
      .isVisible('#mattermostView1').should.eventually.be.true
      .isVisible('#mattermostView0').should.eventually.be.false
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
    return this.app.restart().then(() => {
      return this.app.client.waitUntilWindowLoaded()
        .waitForVisible('#mattermostView0-fail', 20000)
    });
  });
});
