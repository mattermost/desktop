'use strict';

const fs = require('fs');

const env = require('../modules/environment');

describe('application', function desc() {
  this.timeout(30000);

  beforeEach(() => {
    env.cleanTestConfig();
    this.app = env.getSpectronApp();
  });

  afterEach(() => {
    if (this.app && this.app.isRunning()) {
      return this.app.stop().then(() => {
        env.cleanTestConfig();
      });
    }
    env.cleanTestConfig();
    return true;
  });

  it('should show a window', () => {
    return this.app.start().then(() => {
      return this.app.client.
        waitUntilWindowLoaded().
        getWindowCount().then((count) => count.should.equal(1)).
        browserWindow.isDevToolsOpened().then((opened) => opened.should.be.false).
        browserWindow.isVisible().then((visible) => visible.should.be.true);
    });
  });

  it.skip('should restore window bounds', () => {
    // bounds seems to be incorrectly calculated in some environments
    // - Windows 10: OK
    // - CircleCI: NG
    const expectedBounds = {x: 100, y: 200, width: 300, height: 400};
    fs.writeFileSync(env.boundsInfoPath, JSON.stringify(expectedBounds));
    return this.app.start().then(() => {
      return this.app.browserWindow.getBounds();
    }).then((bounds) => {
      bounds.should.deep.equal(expectedBounds);
    });
  });

  it('should NOT restore window bounds if the origin is located on outside of viewarea', () => {
    // bounds seems to be incorrectly calculated in some environments (e.g. CircleCI)
    // - Windows 10: OK
    // - CircleCI: NG
    fs.writeFileSync(env.boundsInfoPath, JSON.stringify({x: -100000, y: 200, width: 300, height: 400}));
    return this.app.start().then(() => {
      return this.app.browserWindow.getBounds();
    }).then((bounds) => {
      bounds.x.should.satisfy((x) => (x > -10000));
    }).then(() => {
      fs.writeFileSync(env.boundsInfoPath, JSON.stringify({x: 100, y: 200000, width: 300, height: 400}));
      return this.app.restart();
    }).then(() => {
      return this.app.browserWindow.getBounds();
    }).then((bounds) => {
      bounds.y.should.satisfy((y) => (y < 10000));
    });
  });

  it('should show settings.html when there is no config file', () => {
    return this.app.start().then(() => {
      return this.app.client.
        waitUntilWindowLoaded().
        getUrl().then((url) => url.should.match(/\/settings.html$/)).
        isExisting('#newServerModal').then((existing) => existing.should.equal(true));
    });
  });

  it('should show index.html when there is config file', () => {
    fs.writeFileSync(env.configFilePath, JSON.stringify({
      url: env.mattermostURL
    }));
    return this.app.start().then(() => {
      return this.app.client.
        waitUntilWindowLoaded().
        getUrl().then((url) => url.should.match(/\/index.html$/));
    });
  });

  it('should upgrade v0 config file', () => {
    const settings = require('../../src/common/settings');
    fs.writeFileSync(env.configFilePath, JSON.stringify({
      url: env.mattermostURL
    }));
    return this.app.start().then(() => {
      return this.app.client.
        waitUntilWindowLoaded().
        getUrl().then((url) => url.should.match(/\/index.html$/));
    }).then(() => {
      var str = fs.readFileSync(env.configFilePath, 'utf8');
      var config = JSON.parse(str);
      config.version.should.equal(settings.version);
    });
  });

  it.skip('should be stopped when the app instance already exists', (done) => {
    this.app.start().then(() => {
      const secondApp = env.getSpectronApp();

      // In the correct case, 'start().then' is not called.
      // So need to use setTimeout in order to finish this test.
      const timer = setTimeout(() => {
        done();
      }, 3000);
      secondApp.start().then(() => {
        clearTimeout(timer);
        return secondApp.stop();
      }).then(() => {
        done(new Error('Second app instance exists'));
      });
    });
  });
});
