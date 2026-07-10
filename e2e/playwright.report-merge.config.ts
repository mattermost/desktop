// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineConfig} from '@playwright/test';

// Used by `npm run send-report` after policy (and other blob-based) runs.
// Merges blob shards once into both the HTML artifact and the JSON TSIO needs.
export default defineConfig({
    reporter: [
        ['html', {open: 'never', outputFolder: 'playwright-report'}],
        ['json', {outputFile: 'test-results/results.json'}],
    ],
});
