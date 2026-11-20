// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'node:fs';
import * as path from 'node:path';

const OUTPUT = path.join('e2e', 'test-results', 'results.json');

const reason = process.env.TSIO_STUB_REASON ||
    (process.env.PLAYWRIGHT_EXIT_CODE && process.env.PLAYWRIGHT_EXIT_CODE !== '0' ?
        `Playwright exited with code ${process.env.PLAYWRIGHT_EXIT_CODE} and no results.json was written` :
        'CI job failed before Playwright JSON results were available');

const jobLabel = process.env.TSIO_GH_JOB_NAME || 'unknown-job';

const report = {
    config: {
        rootDir: path.resolve('e2e'),
        version: '',
    },
    suites: [{
        title: '',
        file: 'ci/tsio-shard-failure.ts',
        column: 0,
        line: 0,
        specs: [{
            title: `[${jobLabel}] CI shard failure`,
            ok: false,
            tags: ['@tsio-stub'],
            tests: [{
                timeout: 0,
                annotations: [],
                expectedStatus: 'passed',
                projectName: jobLabel,
                results: [{
                    workerIndex: 0,
                    status: 'failed',
                    duration: 0,
                    error: {message: reason},
                }],
                status: 'failed',
            }],
        }],
    }],
};

fs.mkdirSync(path.dirname(OUTPUT), {recursive: true});
fs.writeFileSync(OUTPUT, JSON.stringify(report));
console.log(`Wrote TSIO failure stub to ${OUTPUT}: ${reason}`);
