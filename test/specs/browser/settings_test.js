'use strict';

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
    env.addClientCommands(this.app.client);
    return this.app.client
      .loadSettingsPage()
      .click('#btnCancel')
      .pause(1000)
      .getUrl().should.eventually.match(/\/index.html$/)
  });

  it('should show index.thml when Save button is clicked', function() {
    env.addClientCommands(this.app.client);
    return this.app.client
      .loadSettingsPage()
      .click('#btnSave')
      .pause(1000)
      .getUrl().should.eventually.match(/\/index.html$/)
  });

  describe('Options', function() {
    describe('Hide Menu Bar', function() {
      it('should appear on win32 or linux', function() {
        const expected = (process.platform === 'win32' || process.platform === 'linux');
        env.addClientCommands(this.app.client);
        return this.app.client
          .loadSettingsPage()
          .isExisting('#inputHideMenuBar').should.eventually.equal(expected)
      });

      [true, false].forEach(function(v) {
        env.shouldTest(it, env.isOneOf(['win32', 'linux']))
          (`should be saved and loaded: ${v}`, function() {
            env.addClientCommands(this.app.client);
            return this.app.client
              .loadSettingsPage()
              .isSelected('#inputHideMenuBar input').then((isSelected) => {
                if (isSelected !== v) {
                  return this.app.client.click('#inputHideMenuBar input')
                }
              })
              .click('#btnSave')
              .pause(1000).then(() => {
                const saved_config = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
                saved_config.hideMenuBar.should.equal(v);
              })
              // confirm actual behavior
              .browserWindow.isMenuBarAutoHide().should.eventually.equal(v).then(() => {
                return this.app.restart();
              }).then(() => {
                env.addClientCommands(this.app.client);
                return this.app.client
                  // confirm actual behavior
                  .browserWindow.isMenuBarAutoHide().should.eventually.equal(v)
                  .loadSettingsPage()
                  .isSelected('#inputHideMenuBar input').should.eventually.equal(v);
              });
          });
      });
    });

    describe('Allow mixed content', function() {
      [true, false].forEach(function(v) {
        it(`should be saved and loaded: ${v}`, function() {
          env.addClientCommands(this.app.client);
          return this.app.client
            .loadSettingsPage()
            .isSelected('#inputDisableWebSecurity input').then((isSelected) => {
              if (isSelected !== v) {
                return this.app.client.click('#inputDisableWebSecurity input')
              }
            })
            .click('#btnSave')
            .pause(1000).then(() => {
              const saved_config = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
              saved_config.disablewebsecurity.should.equal(v);
            })
            // confirm actual behavior
            .getAttribute('.mattermostView', 'disablewebsecurity').then((disablewebsecurity) => {
              // disablewebsecurity is an array of String
              disablewebsecurity.forEach((d) => {
                v.toString().should.equal(d);
              })
            }).then(() => {
              return this.app.restart();
            }).then(() => {
              env.addClientCommands(this.app.client);
              return this.app.client
                // confirm actual behavior
                .getAttribute('.mattermostView', 'disablewebsecurity').then((disablewebsecurity) => {
                  // disablewebsecurity is an array of String
                  disablewebsecurity.forEach((d) => {
                    v.toString().should.equal(d);
                  })
                })
                .loadSettingsPage()
                .isSelected('#inputDisableWebSecurity input').should.eventually.equal(v);
            });
        });
      });
    });

    describe('Start app on login', function() {
      it('should appear on win32 or linux', function() {
        const expected = (process.platform === 'win32' || process.platform === 'linux');
        env.addClientCommands(this.app.client);
        return this.app.client
          .loadSettingsPage()
          .isExisting('#inputAutoStart').should.eventually.equal(expected)
      });
    });

    describe('Show tray icon', function() {
      it('should appear on darwin or linux', function() {
        const expected = (process.platform === 'darwin' || process.platform === 'linux');
        env.addClientCommands(this.app.client);
        return this.app.client
          .loadSettingsPage()
          .isExisting('#inputShowTrayIcon').should.eventually.equal(expected)
      });
    });

    describe('Minimize to tray', function() {
      it('should appear on darwin or linux', function() {
        const expected = (process.platform === 'darwin' || process.platform === 'linux');
        env.addClientCommands(this.app.client);
        return this.app.client
          .loadSettingsPage()
          .isExisting('#inputMinimizeToTray').should.eventually.equal(expected)
      });
    });

    describe('Toggle window visibility when clicking on the tray icon', function() {
      it('should appear on win32', function() {
        const expected = (process.platform === 'win32');
        env.addClientCommands(this.app.client);
        return this.app.client
          .loadSettingsPage()
          .isExisting('#inputToggleWindowOnTrayIconClick').should.eventually.equal(expected)
      });
    });

    describe('Notifications', function() {
      it('should appear on win32', function() {
        const expected = (process.platform === 'win32');
        env.addClientCommands(this.app.client);
        return this.app.client
          .loadSettingsPage()
          .isExisting('#notificationsRow').should.eventually.equal(expected)
      });
    });
  });
});
