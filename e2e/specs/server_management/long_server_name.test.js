// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('LongServerName', function desc() {
    this.timeout(30000);
    const config = env.demoConfig;
    const longServerName = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus quis malesuada dolor, vel scelerisque sem';
    const longServerUrl = 'https://example.org';

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();

        const mainView = this.app.windows().find((window) => window.url().includes('index'));
        const dropdownView = this.app.windows().find((window) => window.url().includes('dropdown'));

        await mainView.click('.TeamDropdownButton');
        await dropdownView.click('.TeamDropdown .TeamDropdown__button.addServer');
        newServerView = await this.app.waitForEvent('window', {
            predicate: (window) => window.url().includes('newServer'),
        });

        // wait for autofocus to finish
        await asyncSleep(500);
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    });

    let newServerView;

    it('MM-T4050 Long server name', async () => {
        await newServerView.type('#teamNameInput', longServerName);
        await newServerView.type('#teamUrlInput', longServerUrl);
        await newServerView.click('#saveNewServerModal');

        await asyncSleep(1000);
        const existing = Boolean(await this.app.windows().find((window) => window.url().includes('newServer')));
        existing.should.be.false;

        const mainView = this.app.windows().find((window) => window.url().includes('index'));
        const dropdownView = this.app.windows().find((window) => window.url().includes('dropdown'));

        const isServerTabExists = Boolean(await mainView.locator(`text=${longServerName}`));
        const isServerAddedDropdown = Boolean(await dropdownView.locator(`text=${longServerName}`));
        isServerTabExists.should.be.true;
        isServerAddedDropdown.should.be.true;

        const serverNameLocator = await mainView.locator(`text=${longServerName}`);

        const isTruncated = await serverNameLocator.evaluate((element) => {
            return element.offsetWidth < element.scrollWidth;
        });
        isTruncated.should.be.true;

        const isWithinMaxWidth = await serverNameLocator.evaluate((element) => {
            const width = parseFloat(window.getComputedStyle(element).getPropertyValue('width'));

            return width <= 400;
        });
        isWithinMaxWidth.should.be.true;
    });
});
