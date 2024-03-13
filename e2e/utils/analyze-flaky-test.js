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

        // Filter out the new flaky tests from the failed test titles
        const fixedTests = Array.from(knownFlakyTestsForOS).filter((test) => !failedFullTitles.includes(test));

        const body = generateCommentBodyFunctionalTest(fixedTests, newFailedTests, knownFlakyTestsForOS);
        console.log(body);
    } catch (error) {
        console.error('Error analyzing failures:', error);
    }
}

function generateCommentBodyFunctionalTest(fixedTests, newFailedTests, knownFlakyTestsForOS) {
    const osName = process.env.RUNNER_OS;

    const newTestFailure = newFailedTests.length === 0 ?
        `No new failed tests found on ${osName}.` :
        `New failed tests found on ${osName}:\n${newFailedTests.map((test) => `| ${test}`).join('|\n')}`;

    const flakytestFailure = fixedTests.length === 0 ?
        `No known flaky tests were fixed on ${osName}.` :
        `Known flaky tests fixed on ${osName}:\n${fixedTests.map((test) => `| ${test}`).join('|\n')}`;

    const knownFlakyTestsMessage = knownFlakyTestsForOS.size === 0 ?
        `No known flaky tests found for ${osName}.` :
        `Known flaky tests for ${osName}:\n${Array.from(knownFlakyTestsForOS).map((test) => `| ${test} |`).join('\n')}`;

    const commentBody = `
        ## Flaky Tests Analysis for ${osName}
        
        ### Known Flaky Tests
        
        | Test |
        | --- |
        | ${knownFlakyTestsMessage} |
        
        ### Fixed Tests (Known Flaky Tests Passed)
        
        | Test |
        | --- |
        | ${flakytestFailure} |
        
        ### New Failed Tests
        
        | Test |
        | --- |
        | ${newTestFailure} |
    `;

    return commentBody;
}

module.exports = {
    analyzeFlakyTests,
};
