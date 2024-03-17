// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable no-console */
const path = require('path');

const { MOCHAWESOME_REPORT_DIR } = require('./constants');
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

        const { failedFullTitles } = generateShortSummary(jsonReport);

        // Get the list of known flaky tests for the provided operating system
        const knownFlakyTestsForOS = new Set(knownFlakyTests[os] || []);

        // Filter out the known flaky tests from the failed test titles
        const newFailedTests = failedFullTitles.filter((test) => !knownFlakyTestsForOS.has(test));

        const commentBody = generateCommentBodyFunctionalTest(newFailedTests);

        // Print on CI
        console.log(commentBody);
        console.log(newFailedTests);

        return { commentBody, newFailedTests };
    } catch (error) {
        console.error('Error analyzing failures:', error);
    }
}

function generateCommentBodyFunctionalTest(newFailedTests) {
    const osName = process.env.RUNNER_OS;

    if (newFailedTests.length === 0) {
        const commentBody = `
            ## Test Summary for ${osName}
            
            All stable tests passed on ${osName}.
        `;
        return commentBody;
    }

    const newTestFailure = `New failed tests found on ${osName}:\n${newFailedTests.map((test) => `- ${test}`).join('\n')}`;

    const commentBody = `
        ## Test Summary for ${osName}

        ### New Failed Tests
        
        | Test |
        | --- |
        ${newTestFailure}
    `;

    return commentBody;
}

module.exports = {
    analyzeFlakyTests,
};
