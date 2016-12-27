'use strict';

const fs = require('fs');

const env = require('../modules/environment');

describe('application', function desc() {
  this.timeout(10000);

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
        getWindowCount().should.eventually.equal(1).
        browserWindow.isDevToolsOpened().should.eventually.be.false.
        browserWindow.isVisible().should.eventually.be.true;
    });
  });

  it('should restore window bounds', () => {
    const expectedBounds = {x: 100, y: 200, width: 300, height: 400};
    fs.writeFileSync(env.boundsInfoPath, JSON.stringify(expectedBounds));
    return this.app.start().then(() => {
      return this.app.browserWindow.getBounds();
    }).then((bounds) => {
      bounds.should.deep.equal(expectedBounds);
    });
  });

  it('should NOT restore window bounds if the origin is located on outside of viewarea', () => {
    const expectedMinusBounds = {x: -100000, y: 200, width: 300, height: 400};
    const expectedLargeBounds = {x: 100, y: 200000, width: 300, height: 400};

    fs.writeFileSync(env.boundsInfoPath, JSON.stringify(expectedMinusBounds));
    return this.app.start().then(() => {
      return this.app.browserWindow.getBounds();
    }).then((bounds) => {
      bounds.should.not.deep.equal(expectedMinusBounds);
    }).then(() => {
      fs.writeFileSync(env.boundsInfoPath, JSON.stringify(expectedLargeBounds));
      return this.app.restart();
    }).then((bounds) => {
      bounds.should.not.deep.equal(expectedLargeBounds);
    });
  });

  it('should show settings.html when there is no config file', () => {
    return this.app.start().then(() => {
      return this.app.client.
        waitUntilWindowLoaded().
        getUrl().should.eventually.match(/\/settings.html$/);
    });
  });

  it('should show index.html when there is config file', () => {
    fs.writeFileSync(env.configFilePath, JSON.stringify({
      url: env.mattermostURL
    }));
    return this.app.start().then(() => {
      return this.app.client.
        waitUntilWindowLoaded().
        getUrl().should.eventually.match(/\/index.html$/);
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
        getUrl().should.eventually.match(/\/index.html$/);
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
