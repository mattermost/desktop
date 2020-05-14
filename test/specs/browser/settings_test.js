// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('browser/settings.html', function desc() {
  this.timeout(30000);

  const config = {
    version: 2,
    teams: [{
      name: 'example',
      url: env.mattermostURL,
      order: 0,
    }, {
      name: 'github',
      url: 'https://github.com/',
      order: 1,
    }],
    showTrayIcon: false,
    trayIconTheme: 'light',
    minimizeToTray: false,
    notifications: {
      flashWindow: 0,
      bounceIcon: false,
      bounceIconType: 'informational',
    },
    showUnreadBadge: true,
    useSpellChecker: true,
    enableHardwareAcceleration: true,
    autostart: true,
    darkMode: false,
  };

  beforeEach(async () => {
    fs.writeFileSync(env.configFilePath, JSON.stringify(config));
    await asyncSleep(1000);
    this.app = env.getSpectronApp();
    await this.app.start();
  });

  afterEach(async () => {
    if (this.app && this.app.isRunning()) {
      await this.app.stop();
    }
  });

  describe('Close button', async () => {
    it.skip('should show index.html when it\'s clicked', async () => {
      env.addClientCommands(this.app.client);
      await this.app.client.
        loadSettingsPage().
        click('#btnClose').
        pause(1000);
      const url = await this.app.client.getUrl();
      url.should.match(/\/index.html(\?.+)?$/);
    });

    it('should be disabled when the number of servers is zero', async () => {
      await this.app.stop();
      env.cleanTestConfig();
      await this.app.start();

      await this.app.client.waitUntilWindowLoaded().
        waitForVisible('#newServerModal', 10000).
        click('#cancelNewServerModal');
      let isCloseButtonEnabled = await this.app.client.isEnabled('#btnClose');
      isCloseButtonEnabled.should.equal(false);

      await this.app.client.
        waitForVisible('#newServerModal', true).
        pause(250).
        click('#addNewServer').
        waitForVisible('#newServerModal').
        setValue('#teamNameInput', 'TestTeam').
        pause(100).
        setValue('#teamUrlInput', 'http://example.org').
        click('#saveNewServerModal').
        waitForVisible('#newServerModal', true).
        waitForVisible('#serversSaveIndicator').
        waitForVisible('#serversSaveIndicator', 10000, true); // at least 2500 ms to disappear
      isCloseButtonEnabled = await this.app.client.isEnabled('#btnClose');
      isCloseButtonEnabled.should.equal(true);
    });
  });

  it('should show NewServerModal after all servers are removed', async () => {
    const modalTitleSelector = '.modal-title=Remove Server';
    env.addClientCommands(this.app.client);
    await this.app.client.
      loadSettingsPage().
      click('=Remove').
      waitForVisible(modalTitleSelector).
      element('.modal-dialog').click('.btn=Remove').
      pause(500).
      click('=Remove').
      waitForVisible(modalTitleSelector).
      element('.modal-dialog').click('.btn=Remove').
      pause(500);
    const isModalExisting = await this.app.client.isExisting('#newServerModal');
    isModalExisting.should.be.true;
  });

  describe('Server list', () => {
    it.skip('should open the corresponding tab when a server list item is clicked', async () => {
      env.addClientCommands(this.app.client);
      await this.app.client.
        loadSettingsPage().
        click('h4=example').
        pause(1000).
        waitUntilWindowLoaded();
      let indexURL = await this.app.client.getUrl();
      indexURL.should.match(/\/index.html(\?.+)?$/);

      let isView0Visible = await this.app.client.isVisible('#mattermostView0');
      isView0Visible.should.be.true;

      let isView1Visible = await this.app.client.isVisible('#mattermostView1');
      isView1Visible.should.be.false;

      await this.app.client.
        loadSettingsPage().
        click('h4=github').
        pause(1000).
        waitUntilWindowLoaded();
      indexURL = await this.app.client.getUrl();
      indexURL.should.match(/\/index.html(\?.+)?$/);

      isView0Visible = await this.app.client.isVisible('#mattermostView0');
      isView0Visible.should.be.false;

      isView1Visible = await this.app.client.isVisible('#mattermostView1');
      isView1Visible.should.be.true;
    });
  });

  describe('Options', () => {
    describe.skip('Hide Menu Bar', () => {
      it('should appear on win32 or linux', async () => {
        const expected = (process.platform === 'win32' || process.platform === 'linux');
        env.addClientCommands(this.app.client);
        await this.app.client.loadSettingsPage();
        const existing = await this.app.client.isExisting('#inputHideMenuBar');
        existing.should.equal(expected);
      });

      [true, false].forEach((v) => {
        env.shouldTest(it, env.isOneOf(['win32', 'linux']))(`should be saved and loaded: ${v}`, async () => {
          env.addClientCommands(this.app.client);
          await this.app.client.
            loadSettingsPage().
            scroll('#inputHideMenuBar');
          const isSelected = await this.app.client.isSelected('#inputHideMenuBar');
          if (isSelected !== v) {
            await this.app.client.click('#inputHideMenuBar');
          }

          await this.app.client.
            pause(600).
            click('#btnClose').
            pause(1000);

          const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
          savedConfig.hideMenuBar.should.equal(v);

          let autoHide = await this.app.browserWindow.isMenuBarAutoHide();
          autoHide.should.equal(v);

          // confirm actual behavior
          await this.app.restart();
          env.addClientCommands(this.app.client);

          autoHide = await this.app.browserWindow.isMenuBarAutoHide();
          autoHide.should.equal(v);

          await this.app.loadSettingsPage();
          autoHide = await this.app.client.isSelected('#inputHideMenuBar');
          autoHide.should.equal(v);
        });
      });
    });

    describe('Start app on login', () => {
      it('should appear on win32 or linux', async () => {
        const expected = (process.platform === 'win32' || process.platform === 'linux');
        env.addClientCommands(this.app.client);
        await this.app.client.loadSettingsPage();
        const existing = await this.app.client.isExisting('#inputAutoStart');
        existing.should.equal(expected);
      });
    });

    describe('Show icon in menu bar / notification area', () => {
      it('should appear on darwin or linux', async () => {
        const expected = (process.platform === 'darwin' || process.platform === 'linux');
        env.addClientCommands(this.app.client);
        await this.app.client.loadSettingsPage();
        const existing = await this.app.client.isExisting('#inputShowTrayIcon');
        existing.should.equal(expected);
      });

      describe('Save tray icon setting on mac', () => {
        env.shouldTest(it, env.isOneOf(['darwin', 'linux']))('should be saved when it\'s selected', async () => {
          env.addClientCommands(this.app.client);
          await this.app.browserWindow.setSize(1024, 768); // Resize the window to click the element
          await this.app.client.
            loadSettingsPage().
            click('#inputShowTrayIcon').
            waitForAppOptionsAutoSaved();

          let config0 = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
          config0.showTrayIcon.should.true;

          await this.app.client.
            click('#inputShowTrayIcon').
            waitForAppOptionsAutoSaved();

          config0 = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
          config0.showTrayIcon.should.false;
        });
      });

      describe('Save tray icon theme on linux', () => {
        env.shouldTest(it, process.platform === 'linux')('should be saved when it\'s selected', async () => {
          env.addClientCommands(this.app.client);
          await this.app.browserWindow.setSize(1024, 768); // Resize the window to click the element
          await this.app.client.
            loadSettingsPage().
            click('#inputShowTrayIcon').
            click('input[value="dark"]').
            pause(700); // wait auto-save

          const config0 = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
          config0.trayIconTheme.should.equal('dark');

          await this.app.client.
            click('input[value="light"]').
            pause(700); // wait auto-save

          const config1 = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
          config1.trayIconTheme.should.equal('light');
        });
      });
    });

    describe('Leave app running in notification area when application window is closed', () => {
      it('should appear on linux', async () => {
        const expected = (process.platform === 'linux');
        env.addClientCommands(this.app.client);
        await this.app.client.loadSettingsPage();
        const existing = await this.app.client.isExisting('#inputMinimizeToTray');
        existing.should.equal(expected);
      });
    });

    describe.skip('Toggle window visibility when clicking on the tray icon', () => {
      it('should appear on win32', async () => {
        const expected = (process.platform === 'win32');
        env.addClientCommands(this.app.client);
        await this.app.client.loadSettingsPage();
        const existing = await this.app.client.isExisting('#inputToggleWindowOnTrayIconClick');
        existing.should.equal(expected);
      });
    });

    describe('Flash app window and taskbar icon when a new message is received', () => {
      it('should appear on win32 and linux', async () => {
        const expected = (process.platform === 'win32' || process.platform === 'linux');
        env.addClientCommands(this.app.client);
        await this.app.client.loadSettingsPage();
        const existing = await this.app.client.isExisting('#inputflashWindow');
        existing.should.equal(expected);
      });
    });

    describe('Show red badge on taskbar icon to indicate unread messages', () => {
      it('should appear on darwin or win32', async () => {
        const expected = (process.platform === 'darwin' || process.platform === 'win32');
        env.addClientCommands(this.app.client);
        await this.app.client.loadSettingsPage();
        const existing = await this.app.client.isExisting('#inputShowUnreadBadge');
        existing.should.equal(expected);
      });
    });

    describe('Check spelling', () => {
      it('should appear and be selectable', async () => {
        env.addClientCommands(this.app.client);
        await this.app.client.loadSettingsPage();
        const existing = await this.app.client.isExisting('#inputSpellChecker');
        existing.should.equal(true);

        const selected = await this.app.client.isSelected('#inputSpellChecker');
        selected.should.equal(true);

        const windowBounds = await this.app.browserWindow.getBounds();
        const inputLocation = await this.app.client.getLocation('#inputSpellChecker');
        const offset = (inputLocation.y - windowBounds.height) + 100;

        await this.app.client.
          scroll(0, offset).
          click('#inputSpellChecker').
          pause(5000);
        const config1 = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
        config1.useSpellChecker.should.equal(false);
      });
    });

    describe('Enable GPU hardware acceleration', () => {
      it('should save selected option', async () => {
        const ID_INPUT_ENABLE_HARDWARE_ACCELERATION = '#inputEnableHardwareAcceleration';
        env.addClientCommands(this.app.client);
        await this.app.client.
          loadSettingsPage().
          waitForExist(ID_INPUT_ENABLE_HARDWARE_ACCELERATION, 5000).
          scroll(ID_INPUT_ENABLE_HARDWARE_ACCELERATION);
        const selected = await this.app.client.isSelected(ID_INPUT_ENABLE_HARDWARE_ACCELERATION);
        selected.should.equal(true); // default is true

        await this.app.client.click(ID_INPUT_ENABLE_HARDWARE_ACCELERATION).
          waitForVisible('#appOptionsSaveIndicator', 5000).
          waitForVisible('#appOptionsSaveIndicator', 5000, true); // at least 2500 ms to disappear
        const config0 = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
        config0.enableHardwareAcceleration.should.equal(false);

        await this.app.client.click(ID_INPUT_ENABLE_HARDWARE_ACCELERATION).
          waitForVisible('#appOptionsSaveIndicator', 5000).
          waitForVisible('#appOptionsSaveIndicator', 5000, true); // at least 2500 ms to disappear
        const config1 = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
        config1.enableHardwareAcceleration.should.equal(true);
      });
    });
  });

  describe('RemoveServerModal', () => {
    const modalTitleSelector = '.modal-title=Remove Server';

    beforeEach(async () => {
      env.addClientCommands(this.app.client);
      await this.app.client.loadSettingsPage();
      const existing = await this.app.client.isExisting(modalTitleSelector);
      existing.should.be.false;

      const visible = await this.app.client.isVisible(modalTitleSelector);
      visible.should.be.false;

      await this.app.client.
        click('=Remove').
        waitForVisible(modalTitleSelector);
    });

    it('should remove existing team on click Remove', async () => {
      await this.app.client.
        element('.modal-dialog').click('.btn=Remove').
        waitForExist(modalTitleSelector, 5000, true);

      await this.app.client.waitForVisible('#serversSaveIndicator', 10000, true);

      const expectedConfig = JSON.parse(JSON.stringify(config.teams.slice(1)));
      expectedConfig.forEach((value) => {
        value.order--;
      });

      const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
      savedConfig.teams.should.deep.equal(expectedConfig);
    });

    it('should NOT remove existing team on click Cancel', async () => {
      await this.app.client.
        element('.modal-dialog').click('.btn=Cancel').
        waitForExist(modalTitleSelector, 5000, true);

      await this.app.client.waitForVisible('#serversSaveIndicator', 10000, true);

      const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
      savedConfig.teams.should.deep.equal(config.teams);
    });

    it('should disappear on click Close', async () => {
      await this.app.client.
        element('.modal-dialog').click('button.close').
        waitForVisible(modalTitleSelector, 10000, true);
      const existing = await this.app.client.isExisting(modalTitleSelector);
      existing.should.be.false;
    });

    it('should disappear on click background', async () => {
      await this.app.browserWindow.setSize(1024, 768); // Resize the window to click the center of <body>
      await this.app.client.
        click('body').
        waitForVisible(modalTitleSelector, 10000, true);
      const existing = await this.app.client.isExisting(modalTitleSelector);
      existing.should.be.false;
    });
  });

  describe('NewTeamModal', () => {
    beforeEach(() => {
      env.addClientCommands(this.app.client);
      return this.app.client.
        loadSettingsPage().
        click('#addNewServer').
        pause(1000);
    });

    it('should open the new server modal', () => {
      return this.app.client.isExisting('#newServerModal').then((existing) => {
        existing.should.be.true;
      });
    });

    it('should close the window after clicking cancel', () => {
      return this.app.client.
        click('#cancelNewServerModal').
        waitForExist('#newServerModal', 10000, true).
        isExisting('#newServerModal').then((existing) => {
          existing.should.be.false;
        });
    });

    it('should not be valid if no team name has been set', () => {
      return this.app.client.
        click('#saveNewServerModal').
        waitForExist('.has-error #teamNameInput', 10000).
        isExisting('.has-error #teamNameInput').then((existing) => {
          existing.should.be.true;
        });
    });

    it('should not be valid if no server address has been set', () => {
      return this.app.client.
        click('#saveNewServerModal').
        waitForExist('.has-error #teamUrlInput', 10000).
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

      it('should add the team to the config file', async () => {
        await this.app.client.
          click('#saveNewServerModal').
          waitForVisible('#newServerModal', 10000, true).
          waitForVisible('#serversSaveIndicator', 10000).
          waitForVisible('#serversSaveIndicator', 10000, true). // at least 2500 ms to disappear
          waitUntilWindowLoaded();

        const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
        savedConfig.teams.should.deep.contain({
          name: 'TestTeam',
          url: 'http://example.org',
          order: 2,
        });
      });
    });
  });
});
