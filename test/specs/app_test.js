// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const env = require('../modules/environment');

describe('application', function desc() {
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
    });

    it('should show the new server modal when no servers exist', async () => {
        const newServerModal = this.app.windows().find((window) => window.url().includes('newServer'));
        const modalTitle = await newServerModal.innerText('#newServerModal .modal-title');
        modalTitle.should.equal('Add Server');
    });

    it('should show no servers configured in dropdown when no servers exist', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const dropdownButtonText = await mainWindow.innerText('.TeamDropdownButton');
        dropdownButtonText.should.equal('No servers configured');
    });

    it('should be stopped when the app instance already exists', (done) => {
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
