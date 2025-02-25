// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('RemoveServerModal', function desc() {
    this.timeout(30000);
    const config = env.demoConfig;

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();

        const mainView = this.app.windows().find((window) => window.url().includes('index'));
        const dropdownView = this.app.windows().find((window) => window.url().includes('dropdown'));
        await mainView.click('.ServerDropdownButton');
        await dropdownView.hover('.ServerDropdown .ServerDropdown__button:nth-child(1)');
        await dropdownView.click('.ServerDropdown .ServerDropdown__button:nth-child(1) button.ServerDropdown__button-remove');

        removeServerView = await this.app.waitForEvent('window', {
            predicate: (window) => window.url().includes('removeServer'),
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

    let removeServerView;

    it('MM-T4390_1 should remove existing server on click Remove', async () => {
        await removeServerView.click('button:has-text("Remove")');
        await asyncSleep(1000);

        const expectedConfig = JSON.parse(JSON.stringify(config.teams.slice(1)));
        expectedConfig.forEach((value) => {
            value.order--;
        });

        const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
        savedConfig.teams.should.deep.equal(expectedConfig);
    });

    it('MM-T4390_2 should NOT remove existing server on click Cancel', async () => {
        await removeServerView.click('button:has-text("Cancel")');
        await asyncSleep(1000);

        const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
        savedConfig.teams.should.deep.equal(config.teams);
    });

    it('MM-T4390_3 should disappear on click Close', async () => {
        await removeServerView.click('button.close');
        await asyncSleep(1000);
        const existing = Boolean(await this.app.windows().find((window) => window.url().includes('removeServer')));
        existing.should.be.false;
    });

    it('MM-T4390_4 should disappear on click background', async () => {
        // ignore any target closed error
        try {
            await removeServerView.click('.Modal', {position: {x: 20, y: 20}});
        } catch {} // eslint-disable-line no-empty
        await asyncSleep(1000);
        const existing = Boolean(await this.app.windows().find((window) => window.url().includes('removeServer')));
        existing.should.be.false;
    });
});
