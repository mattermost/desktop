'use strict';

const path = require('path');
const fs = require('fs');

const env = require('../../modules/environment');

function initClient(client) {
  return client
    .url('file://' + path.join(env.sourceRootDir, 'dist/browser/settings.html'))
    .waitUntilWindowLoaded();
}

function addClientCommands(client) {
  client.addCommand('loadSettingsPage', function() {
    return this
      .url('file://' + path.join(env.sourceRootDir, 'dist/browser/settings.html'))
      .waitUntilWindowLoaded();
  });
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

  it('should show index.thml when Cancel button is clicked', function() {
    return initClient(this.app.client)
      .click('#btnCancel')
      .pause(1000)
      .getUrl().should.eventually.match(/\/index.html$/)
  });

  it('should show index.thml when Save button is clicked', function() {
    return initClient(this.app.client)
      .click('#btnSave')
      .pause(1000)
      .getUrl().should.eventually.match(/\/index.html$/)
  });

  describe('Options', function() {
    describe('Hide Menu Bar', function() {
      it('should appear on win32 or linux', function() {
        const expected = (process.platform === 'win32' || process.platform === 'linux');
        return initClient(this.app.client)
          .isExisting('#inputHideMenuBar').should.eventually.equal(expected)
      });

      [true, false].forEach(function(v) {
        it(`should be loaded from config: ${v}`, function() {
          env.shouldTestForPlatforms(this, ['win32', 'linux']);
          var new_config = {};
          Object.assign(new_config, config);
          new_config.hideMenuBar = v;
          fs.writeFileSync(env.configFilePath, JSON.stringify(new_config));
          return this.app.restart().then(() => {
            return initClient(this.app.client)
              .isSelected('#inputHideMenuBar input').should.eventually.equal(v)
              .browserWindow.isMenuBarAutoHide().should.eventually.equal(v);
          });
        });
      });

      it('should be saved as config.json', function() {
        env.shouldTestForPlatforms(this, ['win32', 'linux']);
        return this.app.restart().then(() => {
            return initClient(this.app.client)
              .click('#inputHideMenuBar input')
              .click('#btnSave')
              .pause(1000)
          })
          .then(() => {
            const saved_config = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
            saved_config.hideMenuBar.should.be.true;
          });
      });
    });

    describe('Allow mixed content', function() {
      [true, false].forEach(function(v) {
        it(`should be loaded from config: ${v}`, function() {
          var new_config = {};
          Object.assign(new_config, config);
          new_config.disablewebsecurity = v;
          fs.writeFileSync(env.configFilePath, JSON.stringify(new_config));
          return this.app.restart().then(() => {
            addClientCommands(this.app.client);
            return this.app.client
              .getAttribute('.mattermostView', 'disablewebsecurity').then((disablewebsecurity) => {
                // disablewebsecurity is an array of String
                disablewebsecurity.forEach((d) => {
                  v.toString().should.equal(d)
                })
              })
              .loadSettingsPage()
              .isSelected('#inputDisableWebSecurity input').should.eventually.equal(v);
          });
        });
      });

      [true, false].forEach(function(v) {
        it(`should be saved as config.json: ${v}`, function() {
          return this.app.restart().then(() => {
            addClientCommands(this.app.client);
            return this.app.client
              .loadSettingsPage()
              .isSelected('#inputDisableWebSecurity input').then((isSelected) => {
                if (isSelected !== v) {
                  return this.app.client.click('#inputDisableWebSecurity input')
                }
              })
              .click('#btnSave')
              .pause(1000)
              .then(() => {
                const saved_config = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
                saved_config.disablewebsecurity.should.equal(v);
              });
          });
        });
      });

    });
  });
});
