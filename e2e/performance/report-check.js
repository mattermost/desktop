// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */
const path = require('path');

const {readJsonFromFile} = require('../utils/report');
const {PERFORMANCE_REPORT_DIR} = require('../utils/constants');

function checkReport() {
    // Import
    const jsonReport = readJsonFromFile(path.join(PERFORMANCE_REPORT_DIR, 'perf-test-report.json'));

    const slowTests = jsonReport?.passes?.filter((test) => test.speed === 'slow');

    if (jsonReport.failures.length > 0) {
        console.error('\tSome tests failed:');
        jsonReport.failures.forEach((test) => {
            console.warn(`\t- ${test.fullTitle}\n`);
        });
        process.exitCode = jsonReport.failures.length;
        return;
    }

    if (slowTests.length > 0) {
        console.warn('\tSlow tests detected:\n');
        slowTests.forEach((test) => {
            console.warn(`\t- ${test.fullTitle}: (${test.duration}ms)\n`);
        });
        process.exitCode = slowTests.length;
        return;
    }

    console.log('No slow tests detected');
    process.exitCode = 0;
}

checkReport();
