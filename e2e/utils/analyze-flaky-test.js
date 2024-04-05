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

        // Check if any known failed tests are fixed
        const fixedTests = [...knownFlakyTestsForOS].filter((test) => !failedFullTitles.includes(test));

        const commentBody = generateCommentBodyFunctionalTest(newFailedTests, fixedTests);

        // Print on CI
        console.log(commentBody);

        return {commentBody, newFailedTests};
    } catch (error) {
        console.error('Error analyzing failures:', error);
        return {};
    }
}

function generateCommentBodyFunctionalTest(newFailedTests, fixedTests) {
    const osName = process.env.RUNNER_OS;
    const build = process.env.BUILD_TAG;

    let commentBody = `
## Test Summary for ${osName} on commit ${build}
    `;

    if (newFailedTests.length === 0 && fixedTests.length === 0) {
        commentBody += `
All stable tests passed on ${osName}.
    `;
        return commentBody;
    }

    if (newFailedTests.length > 0) {
        const newTestFailure = `New failed tests found on ${osName}:\n${newFailedTests.map((test) => `- ${test}`).join('\n')}`;
        commentBody += `
${newTestFailure}
    `;
    }

    if (fixedTests.length > 0) {
        const fixedTestMessage = `The following known failed tests have been fixed on ${osName}:\n\t${fixedTests.map((test) => `- ${test}`).join('\n\t')}`;
        commentBody += `
${fixedTestMessage}
    `;
    }

    return commentBody;
}

module.exports = {
    analyzeFlakyTests,
};
