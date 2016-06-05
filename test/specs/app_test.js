'use strict';

const path = require('path');
const fs = require('fs');

const env = require('../modules/environment');

describe('application', function() {
  this.timeout(10000);

  beforeEach(function(done) {
    this.app = env.getSpectronApp();
    fs.unlink(env.configFilePath, () => {
      done();
    });
  });

  afterEach(function() {
    if (this.app && this.app.isRunning()) {
      return this.app.stop()
    }
  });

  it('should show a window', function() {
    return this.app.start().then(() => {
      return this.app.client.waitUntilWindowLoaded()
        .getWindowCount().should.eventually.equal(1)
        .browserWindow.isDevToolsOpened().should.eventually.be.false
        .browserWindow.isVisible().should.eventually.be.true
    });
  });

  it('should show settings.html when there is no config file', function() {
    return this.app.start().then(() => {
      return this.app.client.waitUntilWindowLoaded()
        .getUrl().should.eventually.match(/\/settings.html$/)
    });
  });

  it('should show index.html when there is config file', function() {
    fs.writeFileSync(env.configFilePath, JSON.stringify({
      url: env.mattermostURL
    }));
    return this.app.start().then(() => {
      return this.app.client.waitUntilWindowLoaded()
        .getUrl().should.eventually.match(/\/index.html$/)
    });
  });

  it('should upgrade v0 config file', function() {
    const settings = require('../../src/common/settings');
    fs.writeFileSync(env.configFilePath, JSON.stringify({
      url: env.mattermostURL
    }));
    return this.app.start().then(() => {
      return this.app.client.waitUntilWindowLoaded()
        .getUrl().should.eventually.match(/\/index.html$/)
    }).then(function() {
      var str = fs.readFileSync(env.configFilePath, 'utf8');
      var config = JSON.parse(str);
      config.version.should.equal(settings.version);
    });
  });
});
