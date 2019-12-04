// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Selector} from 'testcafe';

import {cleanTestConfig, createTestUserDataDir} from '../test/modules/utils';

fixture `desktop security tests`.page('../src/browser/index.html'); // eslint-disable-line no-undef

test('should NOT be able to call Node.js API in webview', async (t) => {
  createTestUserDataDir();
  cleanTestConfig();
  await t.wait(1000);
  await t.typeText('#teamNameInput', 'Mattermost Demo');
  await t.pressKey('Tab');
  await t.typeText('#teamUrlInput', 'https://demo.mattermost.com');
  await t.click('#saveNewServerModal');
  await t.click('#btnClose');
  const webview = Selector('webview'); // eslint-disable-line new-cap
  const webviewExists = await webview.exists;
  await t.expect(webviewExists).ok();
  const nodeIntegration = await webview.getAttribute('nodeIntegration');
  await t.expect(nodeIntegration).eql(undefined); // eslint-disable-line no-undefined
});