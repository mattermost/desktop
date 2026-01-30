// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

const config = env.demoConfig;

describe('menu_bar/dropdown', function desc() {
    const beforeFunc = async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(2000);
        this.app = await env.getApp();
    };

    const afterFunc = async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    };

    this.timeout(90000);

    it('MM-T4405 should set name of menu item from config file', async () => {
        await beforeFunc();

        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const dropdownView = this.app.windows().find((window) => window.url().includes('dropdown'));
        await mainWindow.click('.ServerDropdownButton');
        const firstMenuItem = await dropdownView.innerText('.ServerDropdown button.ServerDropdown__button:nth-child(1) span');
        const secondMenuItem = await dropdownView.innerText('.ServerDropdown button.ServerDropdown__button:nth-child(2) span');

        firstMenuItem.should.equal(config.servers[0].name);
        secondMenuItem.should.equal(config.servers[1].name);

        await afterFunc();
    });

    describe('MM-T4406 should only show dropdown when button is clicked', async () => {
        let mainWindow;
        let browserWindow;

        before(async () => {
            await beforeFunc();
            mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            browserWindow = await this.app.browserWindow(mainWindow);
        });
        after(afterFunc);

        it('MM-T4406_1 should show the dropdown', async () => {
            let dropdownHeight = await browserWindow.evaluate((window) => window.contentView.children.find((view) => view.webContents.getURL().includes('dropdown')).getBounds().height);
            dropdownHeight.should.equal(0);

            await mainWindow.click('.ServerDropdownButton');
            dropdownHeight = await browserWindow.evaluate((window) => window.contentView.children.find((view) => view.webContents.getURL().includes('dropdown')).getBounds().height);
            dropdownHeight.should.be.greaterThan(0);
        });

        it('MM-T4406_2 should hide the dropdown', async () => {
            await mainWindow.click('.TabBar');
            const dropdownHeight = await browserWindow.evaluate((window) => window.contentView.children.find((view) => view.webContents.getURL().includes('dropdown')).getBounds().height);
            dropdownHeight.should.equal(0);
        });
    });

    it('MM-T4407 should open the new server prompt after clicking the add button', async () => {
        await beforeFunc();

        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const dropdownView = this.app.windows().find((window) => window.url().includes('dropdown'));
        await mainWindow.click('.ServerDropdownButton');
        await dropdownView.click('.ServerDropdown__button.addServer');

        const newServerModal = await this.app.waitForEvent('window', {
            predicate: (window) => window.url().includes('newServer'),
        });
        const modalTitle = await newServerModal.innerText('#newServerModal .Modal__header__text_container');
        modalTitle.should.equal('Add Server');

        await afterFunc();
    });

    describe('MM-T4408 Switch Servers', async () => {
        let mainWindow;
        let browserWindow;
        let dropdownView;

        before(async () => {
            await beforeFunc();
            mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            browserWindow = await this.app.browserWindow(mainWindow);
            dropdownView = this.app.windows().find((window) => window.url().includes('dropdown'));
        });
        after(afterFunc);

        it('MM-T4408_1 should show the first view', async () => {
            // Wait for views to be initialized and attached
            await asyncSleep(500);

            await browserWindow.evaluate((window, url) => {
                return new Promise((resolve, reject) => {
                    const maxAttempts = 200; // 20 seconds max (200 * 100ms)
                    let attempts = 0;
                    const checkView = () => {
                        const hasView = window.contentView.children.find((view) => view.webContents.getURL() === url);
                        if (hasView) {
                            resolve();
                        } else if (attempts >= maxAttempts) {
                            // Enhanced error message with diagnostic info
                            const childCount = window.contentView.children.length;
                            const childUrls = window.contentView.children.map((view) => {
                                try {
                                    return view.webContents.getURL();
                                } catch (e) {
                                    return 'error-getting-url';
                                }
                            });
                            reject(new Error(`View with URL ${url} not found after ${maxAttempts * 100}ms. Found ${childCount} children with URLs: ${JSON.stringify(childUrls)}`));
                        } else {
                            attempts++;
                            setTimeout(checkView, 100);
                        }
                    };
                    checkView();
                });
            }, env.exampleURL);

            const firstViewIsAttached = await browserWindow.evaluate((window, url) => Boolean(window.contentView.children.find((view) => view.webContents.getURL() === url)), env.exampleURL);
            firstViewIsAttached.should.be.true;
            const secondViewIsAttached = await browserWindow.evaluate((window) => Boolean(window.contentView.children.find((view) => view.webContents.getURL() === 'https://github.com/')));
            secondViewIsAttached.should.be.false;
        });

        it('MM-T4408_2 should show the second view after clicking the menu item', async () => {
            await mainWindow.click('.ServerDropdownButton');
            await dropdownView.click('.ServerDropdown button.ServerDropdown__button:nth-child(2)');

            const firstViewIsAttached = await browserWindow.evaluate((window, url) => Boolean(window.contentView.children.find((view) => view.webContents.getURL() === url)), env.exampleURL);
            firstViewIsAttached.should.be.false;
            const secondViewIsAttached = await browserWindow.evaluate((window) => Boolean(window.contentView.children.find((view) => view.webContents.getURL() === 'https://github.com/')));
            secondViewIsAttached.should.be.true;
        });
    });
});
