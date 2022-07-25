// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('header', function desc() {
    this.timeout(30000);

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
    });

    afterEach(async () => {
        if (this.app) {
            try {
                await this.app.close();
            // eslint-disable-next-line no-empty
            } catch (err) {}
        }
        await env.clearElectronInstances();
    });

    it('MM-T2637 Double-Clicking on the header should minimize/maximize the app', async () => {
        const initialBounds = {x: 0, y: 0, width: 800, height: 400, maximized: false};
        fs.writeFileSync(env.boundsInfoPath, JSON.stringify(initialBounds));
        this.app = await env.getApp();
        const mainWindow = await this.app.windows().find((window) => window.url().includes('index'));
        const browserWindow = await this.app.browserWindow(mainWindow);
        const header = await mainWindow.locator('div.topBar');
        const headerBounds = await header.boundingBox();
        await header.dblclick({position: {x: headerBounds.width / 2, y: headerBounds.y / 2}});
        await asyncSleep(1000);
        const isMaximized = await browserWindow.evaluate((window) => window.isMaximized());
        isMaximized.should.be.equal(true);
        const maximizedHeaderBounds = await header.boundingBox();
        await header.dblclick({position: {x: maximizedHeaderBounds.width / 2, y: maximizedHeaderBounds.y / 2}});
        await asyncSleep(1000);
        const revertedBounds = await browserWindow.evaluate((window) => window.getContentBounds());
        revertedBounds.height.should.be.equal(initialBounds.height);
        revertedBounds.width.should.be.equal(initialBounds.width);
    });
});
