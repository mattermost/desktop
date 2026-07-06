// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoConfig, type AppConfig} from '../../helpers/config';
import {restoreMessageBox, stubMessageBoxResponses} from '../../helpers/dialog';
import {isMainWindowVisible} from '../../helpers/tray';
import {evaluateInMainProcess} from '../../helpers/testRefs';

const closeDialogConfig: AppConfig = {
    ...demoConfig,
    minimizeToTray: false,
    alwaysClose: false,
};

test.describe('system_tray_icon/window_close_tray', () => {
    test.use({appConfig: closeDialogConfig});

    test(
        'MM-T6195 close button shows quit dialog and keeps app running when user chooses No',
        {tag: ['@P1', '@win32', '@linux']},
        async ({electronApp}) => {
            await expect.poll(
                () => isMainWindowVisible(electronApp),
                {timeout: 10_000},
            ).toBe(true);

            await stubMessageBoxResponses(electronApp, [{response: 1}]);
            try {
                await evaluateInMainProcess(electronApp, () => {
                    const refs = (global as any).__e2eTestRefs;
                    if (!refs) {
                        throw new Error('__e2eTestRefs missing (NODE_ENV must be test)');
                    }
                    refs.MainWindow.get()?.close();
                });

                await expect.poll(
                    () => electronApp.windows().some((window) => window.url().includes('index')),
                    {timeout: 10_000, message: 'App should remain running after declining quit'},
                ).toBe(true);
            } finally {
                await restoreMessageBox(electronApp);
            }
        },
    );
});
