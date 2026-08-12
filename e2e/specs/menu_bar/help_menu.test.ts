// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {clickApplicationMenuItem} from '../../helpers/menu';
import {evaluateInMainProcess} from '../../helpers/testRefs';
import {getShellOpenExternalCalls, restoreShellOpenExternal, stubShellOpenExternal} from '../../helpers/shell';

test.describe('menu_bar/help_menu', () => {
    test(
        'MM-T6150 Check for Updates menu item invokes the update manager',
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
                const updateNotifier = refs?.updateNotifier;
                if (!updateNotifier) {
                    throw new Error('updateNotifier is not exposed in __e2eTestRefs');
                }
                updateNotifier.__e2eCheckForUpdatesCalls = 0;
                updateNotifier.__e2eOriginalCheckForUpdates = updateNotifier.checkForUpdates;
                updateNotifier.checkForUpdates = () => {
                    updateNotifier.__e2eCheckForUpdatesCalls += 1;
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
        'MM-T4804 Copy version string into clipboard',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            await waitForAppReady(electronApp);

            const expectedVersionLabel = await evaluateInMainProcess(electronApp, ({app: electronAppInstance}) => {
                const helpMenu = electronAppInstance.applicationMenu?.getMenuItemById('help');
                const versionItem = helpMenu?.submenu?.items?.find((item) => {
                    return typeof item.label === 'string' && item.label.includes('Desktop App Version');
                });
                return typeof versionItem?.label === 'string' ? versionItem.label : '';
            });
            expect(expectedVersionLabel, 'Help menu must expose a Desktop App Version item').not.toBe('');

            await electronApp.evaluate(({clipboard}) => {
                clipboard.writeText('');
            });

            await clickApplicationMenuItem(electronApp, 'help', {labelIncludes: 'Desktop App Version'});

            await expect.poll(
                () => electronApp.evaluate(({clipboard}) => clipboard.readText()),
                {timeout: 10_000, message: 'Help → Version must copy the desktop version string to the clipboard'},
            ).toBe(expectedVersionLabel);
        },
    );

    test(
        'MM-T6151 Show logs menu item opens the log file location',
        {tag: ['@P1', '@all']},
        async ({electronApp}) => {
            await waitForAppReady(electronApp);

            await evaluateInMainProcess(electronApp, ({shell}) => {
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
                    return evaluateInMainProcess(electronApp, () => {
                        return ((global as any).__e2eShownInFolder as string[] | undefined)?.length ?? 0;
                    });
                }, {timeout: 10_000}).toBeGreaterThan(0);
            } finally {
                await evaluateInMainProcess(electronApp, ({shell}) => {
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
        'MM-T828 Learn More in the Menu Bar opens help documentation externally',
        {tag: ['@P2', '@darwin']},
        async ({electronApp}) => {
            await waitForAppReady(electronApp);

            const helpMenuItem = await evaluateInMainProcess(electronApp, ({app: electronAppInstance}) => {
                const refs = (global as any).__e2eTestRefs;
                const menu = electronAppInstance.applicationMenu?.getMenuItemById('help');
                const userGuideItem = menu?.submenu?.items?.find((item) => {
                    return typeof item.label === 'string' &&
                        item.label.includes('User guide') &&
                        typeof item.click === 'function';
                });
                return {
                    label: typeof userGuideItem?.label === 'string' ? userGuideItem.label : '',
                    helpLink: refs?.Config?.helpLink ?? '',
                };
            });

            expect(helpMenuItem.label, 'Help menu must expose a User guide item').toContain('User guide');
            expect(helpMenuItem.helpLink, 'Config.helpLink must be set').toContain('docs.mattermost.com');

            await stubShellOpenExternal(electronApp);
            try {
                await clickApplicationMenuItem(electronApp, 'help', {label: helpMenuItem.label});

                await expect.poll(
                    () => getShellOpenExternalCalls(electronApp),
                    {timeout: 10_000, message: 'Help > User guide must open documentation via shell.openExternal'},
                ).toContain(helpMenuItem.helpLink);
            } finally {
                await restoreShellOpenExternal(electronApp);
            }
        },
    );
});
