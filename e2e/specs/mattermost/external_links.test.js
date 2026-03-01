// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const robot = require('robotjs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

// Known external URL to paste into Mattermost and click.
// Must NOT match any server URL in the config, otherwise the app routes it
// to an internal tab instead of the system browser.
const EXTERNAL_URL = 'https://github.com/';

describe('external_links', function desc() {
    this.timeout(90000);

    // Use a config with only the Mattermost server so that EXTERNAL_URL is
    // truly external (not registered as a server) and gets routed to the
    // system browser via shell.openExternal.
    const config = {
        ...env.demoMattermostConfig,
        servers: env.demoMattermostConfig.servers.filter((s) => !s.url.includes('github.com')),
    };

    beforeEach(async () => {
        env.cleanDataDir();
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();
        this.serverMap = await env.getServerMap(this.app);
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    });

    if (process.platform !== 'linux') {
        it('MM-T_EL_1 clicking an external URL opens the system browser, not the app', async () => {
            const firstServer = this.serverMap[config.servers[0].name][0].win;
            await env.loginToMattermost(firstServer);
            await asyncSleep(2000);

            await this.app.evaluate(({shell}) => {
                shell._e2eOpenExternalCalls = [];
                shell.openExternal = (url) => {
                    shell._e2eOpenExternalCalls.push(url);
                    return Promise.resolve();
                };
            });

            // Post a message containing the external URL into the current channel
            await firstServer.waitForSelector('#post_textbox', {timeout: 10000});
            await firstServer.click('#post_textbox');
            await firstServer.type('#post_textbox', EXTERNAL_URL);
            robot.keyTap('enter');
            await asyncSleep(2000);

            // Wait for the link to appear in the post list and click it
            const linkSelector = `a[href="${EXTERNAL_URL}"]`;
            await firstServer.waitForSelector(linkSelector, {timeout: 10000});
            await firstServer.click(linkSelector);
            await asyncSleep(1000);

            // Read back which URLs were passed to shell.openExternal
            const openExternalCalls = await this.app.evaluate(({shell}) => shell._e2eOpenExternalCalls);

            // Assert the external URL was sent to the OS browser
            openExternalCalls.should.include(EXTERNAL_URL);

            // Assert no new internal window was opened with the external URL
            const internalWindowOpened = this.app.windows().some((win) => {
                try {
                    return win.url().includes('github.com');
                } catch (e) {
                    return false;
                }
            });
            internalWindowOpened.should.be.false;
        });

        it('MM-T_EL_2 clicking an internal Mattermost channel link stays in the app', async () => {
            const firstServer = this.serverMap[config.servers[0].name][0].win;
            await env.loginToMattermost(firstServer);
            await asyncSleep(2000);

            // Install a spy on shell.openExternal — it must NOT be called for internal links
            await this.app.evaluate(({shell}) => {
                shell._e2eOpenExternalCalls = [];
                shell.openExternal = (url) => {
                    shell._e2eOpenExternalCalls.push(url);
                    return Promise.resolve();
                };
            });

            // Wait for the sidebar to load and get the town-square permalink via context menu
            await firstServer.waitForSelector('#sidebarItem_town-square', {timeout: 10000});
            await firstServer.click('#sidebarItem_town-square', {button: 'right'});
            await asyncSleep(1000);

            // Trigger "Copy Link" from the context menu to get a Mattermost channel URL
            switch (process.platform) {
            case 'win32':
                robot.keyTap('down');
                robot.keyTap('down');
                break;
            case 'darwin':
                robot.keyTap('c');
                break;
            }
            robot.keyTap('enter');
            await asyncSleep(500);

            // Post the copied Mattermost permalink into the channel
            await firstServer.click('#sidebarItem_town-square');
            await firstServer.click('#post_textbox');

            // Paste via keyboard shortcut
            robot.keyTap('v', process.platform === 'darwin' ? 'command' : 'control');
            await asyncSleep(500);
            robot.keyTap('enter');
            await asyncSleep(2000);

            // Click the posted Mattermost internal link
            const mattermostLinkSelector = 'a[href*="/channels/town-square"]';
            await firstServer.waitForSelector(mattermostLinkSelector, {timeout: 10000});
            await firstServer.click(mattermostLinkSelector);
            await asyncSleep(1000);

            // Assert shell.openExternal was NOT called — internal link must stay in app
            const openExternalCalls = await this.app.evaluate(({shell}) => shell._e2eOpenExternalCalls);
            openExternalCalls.should.have.lengthOf(0);
        });
    }
});
