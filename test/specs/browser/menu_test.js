// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('Menu bar', function desc() {
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

  const serverPort = 8181;
  const settingsLabel = process.platform === 'darwin' ? 'Preferences...' : 'Settings...';
  const firstMenuName = process.platform === 'darwin' ? '&Mattermost' : '&File';

  before(() => {
    function serverCallback(req, res) {
      res.writeHead(200, {
        'Content-Type': 'text/html',
      });
      res.end(fs.readFileSync(path.resolve(env.sourceRootDir, 'test/modules/test.html'), 'utf-8'));
    }
    this.server = http.createServer(serverCallback).listen(serverPort, '127.0.0.1');
  });

  beforeEach(async () => {
    fs.writeFileSync(env.configFilePath, JSON.stringify(config));
    await asyncSleep(1000);
    this.app = env.getSpectronAppWithMenu();
    await this.app.start();
  });

  afterEach(async () => {
    if (this.app && this.app.isRunning()) {
      await this.app.stop();
    }
  });

  after((done) => {
    this.server.close(done);
  });

  it('File -> Settings: opens settings modal', async () => {
    await env.menuAddon.clickMenu(firstMenuName, settingsLabel);
    const isModalExisting = await this.app.client.isExisting('.settings-modal-dialog');
    isModalExisting.should.be.true;
  });

  describe('File -> Sign in to Another Server', () => {
    it('adds new server', async () => {
      env.addClientCommands(this.app.client);
      let tabBarChildrenLength = await this.app.client.webContents.
        openDevTools().
        execute(() => {
          return document.querySelector('ul#tabBar').children.length;
        });
      tabBarChildrenLength.value.should.equal(3);
      await env.menuAddon.clickMenu(firstMenuName, 'Sign in to Another Server');
      await this.app.client.pause(250).
        setValue('#teamNameInput', 'NewServer').
        setValue('#teamUrlInput', 'http://example.org').
        customClick('#saveNewServerModal');
      await this.app.client.pause(500);
      tabBarChildrenLength = await this.app.client.webContents.
        openDevTools().
        execute(() => {
          return document.querySelector('ul#tabBar').children.length;
        });
      tabBarChildrenLength.value.should.equal(4);
    });

    it('team name input is focused when modal opens', async () => {
      await env.menuAddon.clickMenu(firstMenuName, 'Sign in to Another Server');
      await this.app.client.pause(500);
      const activeElementId = await this.app.client.execute(() => {
        return document.getElementById('teamNameInput').id;
      });
      activeElementId.value.should.equal('teamNameInput');
    });
  });

  describe('while settings modal is open', () => {
    beforeEach(() => {
      env.addClientCommands(this.app.client);
      return this.app.client.
        toggleSettingsPage().
        customClick('#addNewServer').
        pause(250);
    });
    it('Edit > Undo: undoes last input action', async () => {
      await this.app.client.setValue('#teamUrlInput', 'https');
      let teamURL = await this.app.client.getValue('#teamUrlInput');
      teamURL.should.equal('https');
      await env.menuAddon.clickMenu('&Edit', 'Undo');
      teamURL = await this.app.client.getValue('#teamUrlInput');
      teamURL.should.equal('');
    });

    it('Edit > Redo: redoes last undo action', async () => {
      await this.app.client.setValue('#teamUrlInput', 'https');
      let teamURL = await this.app.client.getValue('#teamUrlInput');
      teamURL.should.equal('https');
      await env.menuAddon.clickMenu('&Edit', 'Undo');
      teamURL = await this.app.client.getValue('#teamUrlInput');
      teamURL.should.equal('');
      await env.menuAddon.clickMenu('&Edit', 'Redo');
      teamURL = await this.app.client.getValue('#teamUrlInput');
      teamURL.should.equal('https');
    });

    it('Edit > Cut: cuts selected text', async () => {
      await this.app.client.setValue('#teamUrlInput', 'https');
      await this.app.client.execute(() => {
        const teamNameInput = document.querySelector('#teamUrlInput');
        teamNameInput.select();
      });
      await env.menuAddon.clickMenu('&Edit', 'Cut');
      const teamURL = await this.app.client.getValue('#teamUrlInput');
      teamURL.should.equal('');
      const clipboardValue = await this.app.electron.clipboard.readText();
      clipboardValue.should.equal('https');
    });

    it('Edit > Copy: copies selected text', async () => {
      await this.app.client.setValue('#teamUrlInput', 'https');
      await this.app.client.execute(() => {
        const teamNameInput = document.querySelector('#teamUrlInput');
        teamNameInput.select();
      });
      await env.menuAddon.clickMenu('&Edit', 'Copy');
      const clipboardValue = await this.app.electron.clipboard.readText();
      clipboardValue.should.equal('https');
    });

    it('Edit > Paste: pastes clipboard text into focused input', async () => {
      await this.app.electron.clipboard.writeText('Mattermost Demo');
      await this.app.client.execute(() => {
        const teamNameInput = document.querySelector('#teamNameInput');
        teamNameInput.select();
      });
      await env.menuAddon.clickMenu('&Edit', 'Paste');
      const teamName = await this.app.client.getValue('#teamNameInput');
      teamName.should.equal('Mattermost Demo');
    });
  });

  it('View > Zoom In increases zoom level', async () => {
    env.addClientCommands(this.app.client);
    await env.menuAddon.clickMenu('&View', 'Actual Size');
    let zoomLevel = await this.app.client.execute(() => {
      const webview = document.getElementById('mattermostView0');
      return webview.getZoomLevel();
    });
    zoomLevel.value.should.equal(0);
    await this.app.client.pause(500);
    await env.menuAddon.clickMenu('&View', 'Zoom In');
    await this.app.client.pause(500);
    zoomLevel = await this.app.client.execute(() => {
      const webview = document.getElementById('mattermostView0');
      return webview.getZoomLevel();
    });
    zoomLevel.value.should.equal(1);
    await env.menuAddon.clickMenu('&View', 'Actual Size');
  });

  it('View > Zoom Out decreases zoom level', async () => {
    env.addClientCommands(this.app.client);
    let zoomLevel = await this.app.client.execute(() => {
      const webview = document.getElementById('mattermostView0');
      return webview.getZoomLevel();
    });
    zoomLevel.value.should.equal(0);
    await this.app.client.pause(500);
    await env.menuAddon.clickMenu('&View', 'Zoom Out');
    await this.app.client.pause(500);
    zoomLevel = await this.app.client.execute(() => {
      const webview = document.getElementById('mattermostView0');
      return webview.getZoomLevel();
    });
    zoomLevel.value.should.equal(-1);
    await env.menuAddon.clickMenu('&View', 'Actual Size');
  });

  it('View > Actual Size returns zoom to default level', async () => {
    env.addClientCommands(this.app.client);
    await this.app.client.pause(500);
    await env.menuAddon.clickMenu('&View', 'Zoom Out');
    await this.app.client.pause(500);
    let zoomLevel = await this.app.client.execute(() => {
      const webview = document.getElementById('mattermostView0');
      return webview.getZoomLevel();
    });
    zoomLevel.value.should.equal(-1);
    await this.app.client.pause(500);
    await env.menuAddon.clickMenu('&View', 'Actual Size');
    await this.app.client.pause(500);
    zoomLevel = await this.app.client.execute(() => {
      const webview = document.getElementById('mattermostView0');
      return webview.getZoomLevel();
    });
    zoomLevel.value.should.equal(0);
    await env.menuAddon.clickMenu('&View', 'Actual Size');
  });
});
