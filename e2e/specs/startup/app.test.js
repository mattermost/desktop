// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const robot = require('robotjs');

const env = require('../../modules/environment');

describe('startup/app', function desc() {
    this.timeout(30000);

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        this.app = await env.getApp();
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    });

    it('MM-T4399_1 should show the new server modal when no servers exist', async () => {
        const newServerModal = this.app.windows().find((window) => window.url().includes('newServer'));
        const modalTitle = await newServerModal.innerText('#newServerModal .modal-title');
        modalTitle.should.equal('Add Server');
    });

    it('MM-T4419 should not allow the user to close the new server modal when no servers exist', async () => {
        const newServerModal = this.app.windows().find((window) => window.url().includes('newServer'));

        const existing = await newServerModal.isVisible('#cancelNewServerModal');
        existing.should.be.false;

        robot.keyTap('escape');
        const existingModal = this.app.windows().find((window) => window.url().includes('newServer'));
        existingModal.should.not.be.null;
    });

    it('MM-T4399_2 should show no servers configured in dropdown when no servers exist', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const dropdownButtonText = await mainWindow.innerText('.TeamDropdownButton');
        dropdownButtonText.should.equal('No servers configured');
    });

    it('MM-T4400 should be stopped when the app instance already exists', (done) => {
        const secondApp = env.getApp();

        // In the correct case, 'start().then' is not called.
        // So need to use setTimeout in order to finish this test.
        const timer = setTimeout(() => {
            done();
        }, 3000);
        secondApp.then(() => {
            clearTimeout(timer);
            return secondApp.close();
        }).then(() => {
            done(new Error('Second app instance exists'));
        });
    });
});
