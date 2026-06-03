// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineConfig} from '@playwright/test';

export default defineConfig({
    testDir: './specs',
    reporter: [
        ['html', {open: 'never', outputFolder: 'playwright-report-merged'}],
    ],
});
