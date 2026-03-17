// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoConfig} from '../../helpers/config';

async function openDropdown(electronApp: Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>, mainWindow: any) {
    await mainWindow.click('.ServerDropdownButton');
    const dropdownView = electronApp.windows().find((window) => window.url().includes('dropdown')) ??
        await electronApp.waitForEvent('window', {
            predicate: (window) => window.url().includes('dropdown'),
            timeout: 10_000,
        });
    await dropdownView.waitForLoadState().catch(() => {});
    return dropdownView;
}

async function getDropdownHeight(browserWindow: any) {
    return browserWindow.evaluate((window) => {
        const dropdownView = (window as any).contentView.children.find((view: any) => {
            try {
                return view.webContents.getURL().includes('dropdown');
            } catch {
                return false;
            }
        });

        if (!dropdownView) {
            return 0;
        }

        return dropdownView.getBounds().height;
    });
}

test.describe('menu_bar/dropdown', () => {
    test('MM-T4405 should set name of menu item from config file', {tag: ['@P2', '@all']}, async ({electronApp, mainWindow}) => {
        const dropdownView = await openDropdown(electronApp, mainWindow);
        const firstMenuItem = await dropdownView!.innerText('.ServerDropdown button.ServerDropdown__button:nth-child(1) span');
        const secondMenuItem = await dropdownView!.innerText('.ServerDropdown button.ServerDropdown__button:nth-child(2) span');

        expect(firstMenuItem).toBe(demoConfig.servers[0].name);
        expect(secondMenuItem).toBe(demoConfig.servers[1].name);
    });

    test.describe('MM-T4406 should only show dropdown when button is clicked', () => {
        test('MM-T4406_1 should show the dropdown', {tag: ['@P2', '@all']}, async ({electronApp, mainWindow}) => {
            const browserWindow = await electronApp.browserWindow(mainWindow);

            const dropdownHeight = await getDropdownHeight(browserWindow);
            expect(dropdownHeight).toBe(0);

            await mainWindow.click('.ServerDropdownButton');
            await expect.poll(
                () => getDropdownHeight(browserWindow),
                {timeout: 10_000},
            ).toBeGreaterThan(0);
        });

        test('MM-T4406_2 should hide the dropdown', {tag: ['@P2', '@all']}, async ({electronApp, mainWindow}) => {
            const browserWindow = await electronApp.browserWindow(mainWindow);

            // First open the dropdown
            await mainWindow.click('.ServerDropdownButton');

            // Then hide it by clicking elsewhere
            await mainWindow.click('.TabBar');
            await expect.poll(
                () => getDropdownHeight(browserWindow),
                {timeout: 10_000},
            ).toBe(0);
        });
    });

    test('MM-T4407 should open the new server prompt after clicking the add button', {tag: ['@P2', '@all']}, async ({electronApp, mainWindow}) => {
        const dropdownView = await openDropdown(electronApp, mainWindow);
        await dropdownView!.click('.ServerDropdown__button.addServer');

        const newServerModal = await electronApp.waitForEvent('window', {
            predicate: (window) => window.url().includes('newServer'),
        });
        const modalTitle = await newServerModal.innerText('#newServerModal .Modal__header__text_container');
        expect(modalTitle).toBe('Add Server');
    });

    test.describe('MM-T4408 Switch Servers', () => {
        test('MM-T4408_1 should show the first view', {tag: ['@P2', '@all']}, async ({electronApp, mainWindow}) => {
            const browserWindow = await electronApp.browserWindow(mainWindow);

            await browserWindow.evaluate((window, urlFragment) => {
                return new Promise<void>((resolve, reject) => {
                    const maxAttempts = 200;
                    let attempts = 0;
                    const checkView = () => {
                        const hasView = (window as any).contentView.children.find((view: any) => view.webContents.getURL().includes(urlFragment));
                        if (hasView) {
                            resolve();
                        } else if (attempts >= maxAttempts) {
                            const childCount = (window as any).contentView.children.length;
                            const childUrls = (window as any).contentView.children.map((view: any) => {
                                try {
                                    return view.webContents.getURL();
                                } catch (e) {
                                    return 'error-getting-url';
                                }
                            });
                            reject(new Error(`View with URL containing ${urlFragment} not found after ${maxAttempts * 100}ms. Found ${childCount} children with URLs: ${JSON.stringify(childUrls)}`));
                        } else {
                            attempts++;
                            setTimeout(checkView, 100);
                        }
                    };
                    checkView();
                });
            }, 'example.com');

            const firstViewIsAttached = await browserWindow.evaluate((window, urlFragment) => Boolean((window as any).contentView.children.find((view: any) => view.webContents.getURL().includes(urlFragment))), 'example.com');
            expect(firstViewIsAttached).toBe(true);
            const secondViewIsAttached = await browserWindow.evaluate((window) => Boolean((window as any).contentView.children.find((view: any) => view.webContents.getURL() === 'https://github.com/')));
            expect(secondViewIsAttached).toBe(false);
        });

        test('MM-T4408_2 should show the second view after clicking the menu item', {tag: ['@P2', '@all']}, async ({electronApp, mainWindow}) => {
            const browserWindow = await electronApp.browserWindow(mainWindow);
            const dropdownView = await openDropdown(electronApp, mainWindow);
            await dropdownView!.click('.ServerDropdown button.ServerDropdown__button:nth-child(2)');

            await expect.poll(async () => {
                return browserWindow.evaluate((window) => {
                    const children = (window as any).contentView.children;
                    return {
                        first: Boolean(children.find((view: any) => view.webContents.getURL().includes('example.com'))),
                        second: Boolean(children.find((view: any) => view.webContents.getURL() === 'https://github.com/')),
                    };
                });
            }, {timeout: 10_000}).toEqual({first: false, second: true});
        });
    });
});
