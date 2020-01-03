// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('browser/index.html', function desc() {
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
    this.app = env.getSpectronApp();
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

  it('should set src of webview from config file', async () => {
    const src0 = await this.app.client.getAttribute('#mattermostView0', 'src');
    src0.should.equal(config.teams[0].url);

    const src1 = await this.app.client.getAttribute('#mattermostView1', 'src');
    src1.should.equal(config.teams[1].url);

    const existing = await this.app.client.isExisting('#mattermostView2');
    existing.should.be.false;
  });

  it('should set name of tab from config file', async () => {
    const tabName0 = await this.app.client.getText('#teamTabItem0');
    tabName0.should.equal(config.teams[0].name);

    const tabName1 = await this.app.client.getText('#teamTabItem1');
    tabName1.should.equal(config.teams[1].name);
  });

  it('should show only the selected team', () => {
    return this.app.client.
      waitForVisible('#mattermostView0', 2000).
      waitForVisible('#mattermostView1', 2000, true).
      click('#teamTabItem1').
      waitForVisible('#mattermostView1', 2000).
      waitForVisible('#mattermostView0', 2000, true);
  });

  // validation now prevents incorrect url's from being used
  it.skip('should show error when using incorrect URL', async () => {
    this.timeout(30000);
    fs.writeFileSync(env.configFilePath, JSON.stringify({
      version: 2,
      teams: [{
        name: 'error_1',
        url: 'http://false',
        order: 0,
      }],
    }));
    await this.app.restart();
    return this.app.client.
      waitForVisible('#mattermostView0-fail', 20000);
  });

  it('should set window title by using webview\'s one', async () => {
    fs.writeFileSync(env.configFilePath, JSON.stringify({
      version: 2,
      teams: [{
        name: 'title_test',
        url: `http://localhost:${serverPort}`,
        order: 0,
      }],
    }));
    await this.app.restart();
    await this.app.client.pause(2000);
    const windowTitle = await this.app.browserWindow.getTitle();
    windowTitle.should.equal('Mattermost Desktop testing html');
  });

  // Skip because it's very unstable in CI
  it.skip('should update window title when the activated tab\'s title is updated', async () => {
    fs.writeFileSync(env.configFilePath, JSON.stringify({
      version: 2,
      teams: [{
        name: 'title_test_0',
        url: `http://localhost:${serverPort}`,
        order: 0,
      }, {
        name: 'title_test_1',
        url: `http://localhost:${serverPort}`,
        order: 1,
      }],
    }));
    await this.app.restart();
    await this.app.client.pause(500);

    // Note: Indices of webview are correct.
    // Somehow they are swapped.
    await this.app.client.
      windowByIndex(2).
      execute(() => {
        document.title = 'Title 0';
      });
    await this.app.client.windowByIndex(0).pause(500);
    let windowTitle = await this.app.browserWindow.getTitle();
    windowTitle.should.equal('Title 0');

    await this.app.client.
      windowByIndex(1).
      execute(() => {
        document.title = 'Title 1';
      });
    await this.app.client.windowByIndex(0).pause(500);
    windowTitle = await this.app.browserWindow.getTitle();
    windowTitle.should.equal('Title 0');
  });

  // Skip because it's very unstable in CI
  it.skip('should update window title when a tab is selected', async () => {
    fs.writeFileSync(env.configFilePath, JSON.stringify({
      version: 2,
      teams: [{
        name: 'title_test_0',
        url: `http://localhost:${serverPort}`,
        order: 0,
      }, {
        name: 'title_test_1',
        url: `http://localhost:${serverPort}`,
        order: 1,
      }],
    }));
    await this.app.restart();

    // Note: Indices of webview are correct.
    // Somehow they are swapped.
    await this.app.client.pause(500);

    await this.app.client.
      windowByIndex(2).
      execute(() => {
        document.title = 'Title 0';
      });
    await this.app.client.
      windowByIndex(1).
      execute(() => {
        document.title = 'Title 1';
      });
    await this.app.client.windowByIndex(0).pause(500);

    let windowTitle = await this.app.browserWindow.getTitle();
    windowTitle.should.equal('Title 0');

    await this.app.client.click('#teamTabItem1').pause(500);
    windowTitle = await this.app.browserWindow.getTitle();
    windowTitle.should.equal('Title 1');
  });

  it('should open the new server prompt after clicking the add button', async () => {
    // See settings_test for specs that cover the actual prompt
    await this.app.client.click('#addServerButton').pause(500);
    const isModalExisting = await this.app.client.isExisting('#newServerModal');
    isModalExisting.should.be.true;
  });
});
