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
                refs.UpdateManager.__e2eCheckForUpdatesCalls = 0;
                const original = refs.UpdateManager.checkForUpdates.bind(refs.UpdateManager);
                refs.UpdateManager.checkForUpdates = (...args: unknown[]) => {
                    refs.UpdateManager.__e2eCheckForUpdatesCalls += 1;
                    return original(...args);
                };
            });

            await clickApplicationMenuItem(electronApp, 'help', {labelIncludes: 'Check for Updates'});

            await expect.poll(async () => {
                return electronApp.evaluate(() => {
                    const refs = (global as any).__e2eTestRefs;
                    return refs?.UpdateManager?.__e2eCheckForUpdatesCalls ?? 0;
                });
            }, {timeout: 10_000}).toBeGreaterThan(0);
        },
    );

    test(
        'HELP-02 Show logs menu item opens the log file location',
        {tag: ['@P1', '@all']},
        async ({electronApp}) => {
            await electronApp.evaluate(({shell}) => {
                (global as any).__e2eShownInFolder = [] as string[];
                const original = shell.showItemInFolder.bind(shell);
                shell.showItemInFolder = (fullPath: string) => {
                    (global as any).__e2eShownInFolder.push(fullPath);
                    return original(fullPath);
                };
            });

            await clickApplicationMenuItem(electronApp, 'help', {id: 'Show logs'});

            await expect.poll(async () => {
                return electronApp.evaluate(() => ((global as any).__e2eShownInFolder as string[] | undefined)?.length ?? 0);
            }, {timeout: 10_000}).toBeGreaterThan(0);
        },
    );
});
