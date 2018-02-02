'use strict';

const fs = require('fs');

const env = require('../../modules/environment');

describe('browser/settings.html', function desc() {
  this.timeout(30000);

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

  describe('Close button', () => {
    it('should show index.html when it\'s clicked', () => {
      env.addClientCommands(this.app.client);
      return this.app.client.
        loadSettingsPage().
        click('#btnClose').
        pause(1000).
        getUrl().then((url) => {
          url.should.match(/\/index.html(\?.+)?$/);
        });
    });

    it('should be disabled when the number of servers is zero', () => {
      return this.app.stop().then(() => {
        env.cleanTestConfig();
        return this.app.start();
      }).then(() => {
        return this.app.client.waitUntilWindowLoaded().
          waitForVisible('#newServerModal').
          click('#cancelNewServerModal').
          isEnabled('#btnClose').then((enabled) => {
            enabled.should.equal(false);
          }).
          waitForVisible('#newServerModal', true).
          pause(250).
          click('#addNewServer').
          waitForVisible('#newServerModal').
          setValue('#teamNameInput', 'TestTeam').
          setValue('#teamUrlInput', 'http://example.org').
          click('#saveNewServerModal').
          waitForVisible('#newServerModal', true).
          waitForVisible('#serversSaveIndicator').
          waitForVisible('#serversSaveIndicator', 10000, true). // at least 2500 ms to disappear
          isEnabled('#btnClose').then((enabled) => {
            enabled.should.equal(true);
          });
      });
    });
  });

  it('should show NewServerModal after all servers are removed', () => {
    const modalTitleSelector = '.modal-title=Remove Server';
    env.addClientCommands(this.app.client);
    return this.app.client.
      loadSettingsPage().
      click('=Remove').
      waitForVisible(modalTitleSelector).
      element('.modal-dialog').click('.btn=Remove').
      pause(500).
      click('=Remove').
      waitForVisible(modalTitleSelector).
      element('.modal-dialog').click('.btn=Remove').
      pause(500).
      isExisting('#newServerModal').then((existing) => {
        existing.should.be.true;
      });
  });

  describe('Server list', () => {
    it('should open the corresponding tab when a server list item is clicked', () => {
      env.addClientCommands(this.app.client);
      return this.app.client.
      loadSettingsPage().
      click('h4=example_1').
      pause(100).
      waitUntilWindowLoaded().
      getUrl().then((url) => {
        url.should.match(/\/index.html(\?.+)?$/);
      }).
      isVisible('#mattermostView0').then((visible) => {
        visible.should.be.true;
      }).
      isVisible('#mattermostView1').then((visible) => {
        visible.should.be.false;
      }).

      loadSettingsPage().
      click('h4=example_2').
      pause(100).
      waitUntilWindowLoaded().
      getUrl().then((url) => {
        url.should.match(/\/index.html(\?.+)?$/);
      }).
      isVisible('#mattermostView0').then((visible) => {
        visible.should.be.false;
      }).
      isVisible('#mattermostView1').then((visible) => {
        visible.should.be.true;
      });
    });
  });

  describe('Options', () => {
    describe.skip('Hide Menu Bar', () => {
      it('should appear on win32 or linux', () => {
        const expected = (process.platform === 'win32' || process.platform === 'linux');
        env.addClientCommands(this.app.client);
        return this.app.client.
        loadSettingsPage().
        isExisting('#inputHideMenuBar').then((existing) => {
          existing.should.equal(expected);
        });
      });

      [true, false].forEach((v) => {
        env.shouldTest(it, env.isOneOf(['win32', 'linux']))(`should be saved and loaded: ${v}`, () => {
          env.addClientCommands(this.app.client);
          return this.app.client.
            loadSettingsPage().
            scroll('#inputHideMenuBar').
            isSelected('#inputHideMenuBar').then((isSelected) => {
              if (isSelected !== v) {
                return this.app.client.click('#inputHideMenuBar');
              }
              return true;
            }).
            pause(600).
            click('#btnClose').
            pause(1000).then(() => {
              const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
              savedConfig.hideMenuBar.should.equal(v);
            }).
            browserWindow.isMenuBarAutoHide().then((autoHide) => {
              autoHide.should.equal(v);
            }).then(() => { // confirm actual behavior
              return this.app.restart();
            }).then(() => {
              env.addClientCommands(this.app.client);
              return this.app.client. // confirm actual behavior
                browserWindow.isMenuBarAutoHide().then((autoHide) => {
                  autoHide.should.equal(v);
                }).
                loadSettingsPage().
                isSelected('#inputHideMenuBar').then((autoHide) => {
                  autoHide.should.equal(v);
                });
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
          isExisting('#inputAutoStart').then((existing) => {
            existing.should.equal(expected);
          });
      });
    });

    describe('Show icon in menu bar / notification area', () => {
      it('should appear on darwin or linux', () => {
        const expected = (process.platform === 'darwin' || process.platform === 'linux');
        env.addClientCommands(this.app.client);
        return this.app.client.
          loadSettingsPage().
          isExisting('#inputShowTrayIcon').then((existing) => {
            existing.should.equal(expected);
          });
      });

      describe('Save tray icon theme on linux', () => {
        env.shouldTest(it, process.platform === 'linux')('should be saved when it\'s selected', () => {
          env.addClientCommands(this.app.client);
          return this.app.client.
            loadSettingsPage().
            click('#inputShowTrayIcon').
            click('input[value="light"]').
            pause(700). // wait auto-save
            then(() => {
              const config0 = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
              config0.trayIconTheme.should.equal('light');
              return this.app.client;
            }).
            click('input[value="dark"]').
            pause(700). // wait auto-save
            then(() => {
              const config1 = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
              config1.trayIconTheme.should.equal('dark');
            });
        });
      });
    });

    describe('Leave app running in notification area when application window is closed', () => {
      it('should appear on linux', () => {
        const expected = (process.platform === 'linux');
        env.addClientCommands(this.app.client);
        return this.app.client.
          loadSettingsPage().
          isExisting('#inputMinimizeToTray').then((existing) => {
            existing.should.equal(expected);
          });
      });
    });

    describe.skip('Toggle window visibility when clicking on the tray icon', () => {
      it('should appear on win32', () => {
        const expected = (process.platform === 'win32');
        env.addClientCommands(this.app.client);
        return this.app.client.
          loadSettingsPage().
          isExisting('#inputToggleWindowOnTrayIconClick').then((existing) => {
            existing.should.equal(expected);
          });
      });
    });

    describe('Flash app window and taskbar icon when a new message is received', () => {
      it('should appear on win32 and linux', () => {
        const expected = (process.platform === 'win32' || process.platform === 'linux');
        env.addClientCommands(this.app.client);
        return this.app.client.
          loadSettingsPage().
          isExisting('#inputflashWindow').then((existing) => {
            existing.should.equal(expected);
          });
      });
    });

    describe('Show red badge on taskbar icon to indicate unread messages', () => {
      it('should appear on darwin or win32', () => {
        const expected = (process.platform === 'darwin' || process.platform === 'win32');
        env.addClientCommands(this.app.client);
        return this.app.client.
          loadSettingsPage().
          isExisting('#inputShowUnreadBadge').then((existing) => {
            existing.should.equal(expected);
          });
      });
    });

    describe('Check spelling', () => {
      it('should appear and be selectable', () => {
        env.addClientCommands(this.app.client);
        return this.app.client.
          loadSettingsPage().
          isExisting('#inputSpellChecker').then((existing) => {
            existing.should.equal(true);
          }).
          scroll('#inputSpellChecker').
          isSelected('#inputSpellChecker').then((selected) => {
            selected.should.equal(true);
          }).
          click('#inputSpellChecker').
          pause(700).
          then(() => {
            const config1 = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
            config1.useSpellChecker.should.equal(false);
          });
      });
    });
  });

  describe('RemoveServerModal', () => {
    const modalTitleSelector = '.modal-title=Remove Server';

    beforeEach(() => {
      env.addClientCommands(this.app.client);
      return this.app.client.
        loadSettingsPage().
        isExisting(modalTitleSelector).then((existing) => {
          existing.should.be.false;
        }).
        isVisible(modalTitleSelector).then((visible) => {
          visible.should.be.false;
        }).
        click('=Remove').
        waitForVisible(modalTitleSelector);
    });

    it('should remove existing team on click Remove', (done) => {
      this.app.client.
        element('.modal-dialog').click('.btn=Remove').
        pause(500).
        isExisting(modalTitleSelector).then((existing) => {
          existing.should.be.false;
        }).
        click('#btnClose').
        pause(500).then(() => {
          const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
          savedConfig.teams.should.deep.equal(config.teams.slice(1));
          done();
        });
    });

    it('should NOT remove existing team on click Cancel', (done) => {
      this.app.client.
        element('.modal-dialog').click('.btn=Cancel').
        pause(500).
        isExisting(modalTitleSelector).then((existing) => {
          existing.should.be.false;
        }).
        click('#btnClose').
        pause(500).then(() => {
          const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
          savedConfig.teams.should.deep.equal(config.teams);
          done();
        });
    });

    it('should disappear on click Close', () => {
      return this.app.client.
        click('.modal-dialog button.close').
        pause(500).
        isExisting(modalTitleSelector).then((existing) => {
          existing.should.be.false;
        });
    });

    it('should disappear on click background', () => {
      return this.app.client.
        click('body').
        pause(500).
        isExisting(modalTitleSelector).then((existing) => {
          existing.should.be.false;
        });
    });
  });

  describe('NewTeamModal', () => {
    beforeEach(() => {
      env.addClientCommands(this.app.client);
      return this.app.client.
        loadSettingsPage().
        click('#addNewServer');
    });

    it('should open the new server modal', () => {
      return this.app.client.isExisting('#newServerModal').then((existing) => {
        existing.should.be.true;
      });
    });

    it('should close the window after clicking cancel', () => {
      return this.app.client.
        click('#cancelNewServerModal').
        pause(1000). // Animation
        isExisting('#newServerModal').then((existing) => {
          existing.should.be.false;
        });
    });

    it('should not be valid if no team name has been set', () => {
      return this.app.client.
        click('#saveNewServerModal').
        pause(500).
        isExisting('.has-error #teamNameInput').then((existing) => {
          existing.should.be.true;
        });
    });

    it('should not be valid if no server address has been set', () => {
      return this.app.client.
        click('#saveNewServerModal').
        pause(500).
        isExisting('.has-error #teamUrlInput').then((existing) => {
          existing.should.be.true;
        });
    });

    describe('Valid server name', () => {
      beforeEach(() => {
        return this.app.client.
            setValue('#teamNameInput', 'TestTeam').
            click('#saveNewServerModal');
      });

      it('should not be marked invalid', () => {
        return this.app.client.
            isExisting('.has-error #teamNameInput').then((existing) => {
              existing.should.be.false;
            });
      });

      it('should not be possible to click save', () => {
        return this.app.client.
          getAttribute('#saveNewServerModal', 'disabled').then((disabled) => {
            disabled.should.equal('true');
          });
      });
    });

    describe('Valid server url', () => {
      beforeEach(() => {
        return this.app.client.
            setValue('#teamUrlInput', 'http://example.org').
            click('#saveNewServerModal');
      });

      it('should be valid', () => {
        return this.app.client.
          isExisting('.has-error #teamUrlInput').then((existing) => {
            existing.should.be.false;
          });
      });

      it('should not be possible to click save', () => {
        return this.app.client.
          getAttribute('#saveNewServerModal', 'disabled').then((disabled) => {
            disabled.should.equal('true');
          });
      });
    });

    it('should not be valid if an invalid server address has been set', () => {
      return this.app.client.
        setValue('#teamUrlInput', 'superInvalid url').
        click('#saveNewServerModal').
        pause(500).
        isExisting('.has-error #teamUrlInput').then((existing) => {
          existing.should.be.true;
        });
    });

    describe('Valid Team Settings', () => {
      beforeEach(() => {
        return this.app.client.
            setValue('#teamUrlInput', 'http://example.org').
            setValue('#teamNameInput', 'TestTeam');
      });

      it('should be possible to click add', () => {
        return this.app.client.
          getAttribute('#saveNewServerModal', 'disabled').then((disabled) => {
            (disabled === null).should.be.true;
          });
      });

      it('should add the team to the config file', (done) => {
        this.app.client.
          click('#saveNewServerModal').
          waitForVisible('#newServerModal', true).
          waitForVisible('#serversSaveIndicator').
          waitForVisible('#serversSaveIndicator', 10000, true). // at least 2500 ms to disappear
          waitUntilWindowLoaded().then(() => {
            const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
            savedConfig.teams.should.deep.contain({
              name: 'TestTeam',
              url: 'http://example.org'
            });
            done();
          }).catch((err) => {
            done(err);
          });
      });
    });
  });
});
