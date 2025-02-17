// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable no-console */
const path = require('path');

const {MOCHAWESOME_REPORT_DIR} = require('./constants');
const knownFlakyTests = require('./known_flaky_tests.json');
const {
    generateShortSummary,
    readJsonFromFile,
} = require('./report');

function analyzeFlakyTests() {
    const os = process.platform;
    try {
        // Import
        const jsonReport = readJsonFromFile(path.join(MOCHAWESOME_REPORT_DIR, 'mochawesome.json'));

        const {failedFullTitles} = generateShortSummary(jsonReport);

        // Get the list of known flaky tests for the provided operating system
        const knownFlakyTestsForOS = new Set(knownFlakyTests[os] || []);

        // Filter out the known flaky tests from the failed test titles
        const newFailedTests = failedFullTitles.filter((test) => !knownFlakyTestsForOS.has(test));

        return {newFailedTests, os};
    } catch (error) {
        console.error('Error analyzing failures:', error);
        return {};
    }
}

module.exports = {
    analyzeFlakyTests,
};
