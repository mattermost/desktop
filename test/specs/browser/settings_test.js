'use strict';

const fs = require('fs');

const env = require('../../modules/environment');

describe('browser/settings.html', function desc() {
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

  beforeEach(() => {
    fs.writeFileSync(env.configFilePath, JSON.stringify(config));
    this.app = env.getSpectronApp();
    return this.app.start();
  });

  afterEach(() => {
    if (this.app && this.app.isRunning()) {
      return this.app.stop();
    }
    return true;
  });

  it('should show index.html when Cancel button is clicked', () => {
    env.addClientCommands(this.app.client);
    return this.app.client.
      loadSettingsPage().
      click('#btnCancel').
      pause(1000).
      getUrl().should.eventually.match(/\/index.html$/);
  });

  it('should show index.html when Save button is clicked', () => {
    env.addClientCommands(this.app.client);
    return this.app.client.
      loadSettingsPage().
      click('#btnSave').
      pause(1000).
      getUrl().should.eventually.match(/\/index.html$/);
  });

  describe('Options', () => {
    describe('Hide Menu Bar', () => {
      it('should appear on win32 or linux', () => {
        const expected = (process.platform === 'win32' || process.platform === 'linux');
        env.addClientCommands(this.app.client);
        return this.app.client.
        loadSettingsPage().
        isExisting('#inputHideMenuBar').should.eventually.equal(expected);
      });

      [true, false].forEach((v) => {
        env.shouldTest(it, env.isOneOf(['win32', 'linux']))(`should be saved and loaded: ${v}`, () => {
          env.addClientCommands(this.app.client);
          return this.app.client.
            loadSettingsPage().
            scroll('#inputHideMenuBar').
            isSelected('#inputHideMenuBar input').then((isSelected) => {
              if (isSelected !== v) {
                return this.app.client.click('#inputHideMenuBar input');
              }
              return true;
            }).
            click('#btnSave').
            pause(1000).then(() => {
              const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
              savedConfig.hideMenuBar.should.equal(v);
            }).
            browserWindow.isMenuBarAutoHide().should.eventually.equal(v).then(() => { // confirm actual behavior
              return this.app.restart();
            }).then(() => {
              env.addClientCommands(this.app.client);
              return this.app.client. // confirm actual behavior
                browserWindow.isMenuBarAutoHide().should.eventually.equal(v).
                loadSettingsPage().
                isSelected('#inputHideMenuBar input').should.eventually.equal(v);
            });
        });
      });
    });

    describe('Allow mixed content', () => {
      [true, false].forEach((v) => {
        it(`should be saved and loaded: ${v}`, () => {
          const webPreferences = v ? 'allowDisplayingInsecureContent' : '';
          env.addClientCommands(this.app.client);

          return this.app.client.
            loadSettingsPage().
            scroll('#inputDisableWebSecurity').
            isSelected('#inputDisableWebSecurity input').then((isSelected) => {
              if (isSelected !== v) {
                return this.app.client.click('#inputDisableWebSecurity input');
              }
              return true;
            }).
            click('#btnSave').
            pause(1000).then(() => {
              const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
              savedConfig.disablewebsecurity.should.equal(v);
            }).
            getAttribute('.mattermostView', 'webpreferences').then((disablewebsecurity) => { // confirm actual behavior
              // disablewebsecurity is an array of String
              disablewebsecurity.forEach((d) => {
                d.should.equal(webPreferences);
              });
            }).then(() => {
              return this.app.restart();
            }).then(() => {
              env.addClientCommands(this.app.client);
              return this.app.client. // confirm actual behavior
                getAttribute('.mattermostView', 'webpreferences').then((disablewebsecurity) => { // disablewebsecurity is an array of String
                  disablewebsecurity.forEach((d) => {
                    d.should.equal(webPreferences);
                  });
                }).
                loadSettingsPage().
                isSelected('#inputDisableWebSecurity input').should.eventually.equal(v);
            });
        });
      });
    });

    describe('Start app on login', () => {
      it('should appear on win32 or linux', () => {
        const expected = (process.platform === 'win32' || process.platform === 'linux');
        env.addClientCommands(this.app.client);
        return this.app.client.
          loadSettingsPage().
          isExisting('#inputAutoStart').should.eventually.equal(expected);
      });
    });

    describe('Show tray icon', () => {
      it('should appear on darwin or linux', () => {
        const expected = (process.platform === 'darwin' || process.platform === 'linux');
        env.addClientCommands(this.app.client);
        return this.app.client.
          loadSettingsPage().
          isExisting('#inputShowTrayIcon').should.eventually.equal(expected);
      });
    });

    describe('Minimize to tray', () => {
      it('should appear on darwin or linux', () => {
        const expected = (process.platform === 'darwin' || process.platform === 'linux');
        env.addClientCommands(this.app.client);
        return this.app.client.
          loadSettingsPage().
          isExisting('#inputMinimizeToTray').should.eventually.equal(expected);
      });
    });

    describe('Toggle window visibility when clicking on the tray icon', () => {
      it('should appear on win32', () => {
        const expected = (process.platform === 'win32');
        env.addClientCommands(this.app.client);
        return this.app.client.
          loadSettingsPage().
          isExisting('#inputToggleWindowOnTrayIconClick').should.eventually.equal(expected);
      });
    });

    describe('Flash taskbar icon on new messages', () => {
      it('should appear on win32 and linux', () => {
        const expected = (process.platform === 'win32' || process.platform === 'linux');
        env.addClientCommands(this.app.client);
        return this.app.client.
          loadSettingsPage().
          isExisting('#inputflashWindow').should.eventually.equal(expected);
      });
    });

    describe('Show red icon for unread', () => {
      it('should appear on darwin or win32', () => {
        const expected = (process.platform === 'darwin' || process.platform === 'win32');
        env.addClientCommands(this.app.client);
        return this.app.client.
          loadSettingsPage().
          isExisting('#inputShowUnreadBadge').should.eventually.equal(expected);
      });
    });
  });
});
