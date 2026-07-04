// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {clickApplicationMenuItem} from '../../helpers/menu';

test.describe('menu_bar/help_menu', () => {
    test(
        'HELP-01 Check for Updates menu item invokes the update manager',
        {tag: ['@P1', '@all']},
        async ({electronApp}) => {
            const canUpgrade = await electronApp.evaluate(() => {
                const refs = (global as any).__e2eTestRefs;
                return Boolean(refs?.Config?.canUpgrade);
            });

            if (!canUpgrade) {
                test.skip(true, 'Config.canUpgrade is false in this build');
                return;
            }

            await electronApp.evaluate(() => {
                const refs = (global as any).__e2eTestRefs;
                refs.updateNotifier.__e2eCheckForUpdatesCalls = 0;
                refs.updateNotifier.__e2eOriginalCheckForUpdates = refs.updateNotifier.checkForUpdates;
                refs.updateNotifier.checkForUpdates = () => {
                    refs.updateNotifier.__e2eCheckForUpdatesCalls += 1;
                };
            });

            try {
                await clickApplicationMenuItem(electronApp, 'help', {labelIncludes: 'Check for Updates'});

                await expect.poll(async () => {
                    return electronApp.evaluate(() => {
                        const refs = (global as any).__e2eTestRefs;
                        return refs?.updateNotifier?.__e2eCheckForUpdatesCalls ?? 0;
                    });
                }, {timeout: 10_000}).toBeGreaterThan(0);
            } finally {
                await electronApp.evaluate(() => {
                    const refs = (global as any).__e2eTestRefs;
                    if (refs?.updateNotifier?.__e2eOriginalCheckForUpdates) {
                        refs.updateNotifier.checkForUpdates = refs.updateNotifier.__e2eOriginalCheckForUpdates;
                        delete refs.updateNotifier.__e2eOriginalCheckForUpdates;
                    }
                });
            }
        },
    );

    test(
        'HELP-02 Show logs menu item opens the log file location',
        {tag: ['@P1', '@all']},
        async ({electronApp}) => {
            await electronApp.evaluate(({shell}) => {
                (global as any).__e2eShownInFolder = [] as string[];
                (global as any).__e2eOriginalShowItemInFolder = shell.showItemInFolder.bind(shell);
                shell.showItemInFolder = (fullPath: string) => {
                    (global as any).__e2eShownInFolder.push(fullPath);
                    return (global as any).__e2eOriginalShowItemInFolder(fullPath);
                };
            });

            try {
                await clickApplicationMenuItem(electronApp, 'help', {id: 'Show logs'});

                await expect.poll(async () => {
                    return electronApp.evaluate(() => ((global as any).__e2eShownInFolder as string[] | undefined)?.length ?? 0);
                }, {timeout: 10_000}).toBeGreaterThan(0);
            } finally {
                await electronApp.evaluate(({shell}) => {
                    const original = (global as any).__e2eOriginalShowItemInFolder;
                    if (original) {
                        shell.showItemInFolder = original;
                        delete (global as any).__e2eOriginalShowItemInFolder;
                    }
                    delete (global as any).__e2eShownInFolder;
                });
            }
        },
    );

    test(
        'MM-T828 Learn More in the Menu Bar opens docs.mattermost.com in a browser',
        {tag: ['@P2', '@all']},
        async ({electronApp, appReady: _appReady}) => {
            // Stub shell.openExternal to capture the URL without launching the browser
            await electronApp.evaluate(({shell}) => {
                (global as any).__e2eOpenExternalCalls = [] as string[];
                (global as any).__e2eOriginalOpenExternal = shell.openExternal.bind(shell);
                shell.openExternal = async (url: string) => {
                    (global as any).__e2eOpenExternalCalls.push(url);
                };
            });

            try {
                await clickApplicationMenuItem(electronApp, 'help', {labelIncludes: 'User guide'});

                await expect.poll(
                    () => electronApp.evaluate(() => {
                        const calls: string[] = (global as any).__e2eOpenExternalCalls ?? [];
                        return calls.some((url) => url.includes('docs.mattermost.com'));
                    }),
                    {timeout: 10_000, message: 'Learn More should open docs.mattermost.com'},
                ).toBe(true);
            } finally {
                await electronApp.evaluate(({shell}) => {
                    const original = (global as any).__e2eOriginalOpenExternal;
                    if (original) {
                        shell.openExternal = original;
                        delete (global as any).__e2eOriginalOpenExternal;
                    }
                    delete (global as any).__e2eOpenExternalCalls;
                });
            }
        },
    );
});
