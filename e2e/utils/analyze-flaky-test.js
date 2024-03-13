// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable no-console */
const knownFlakyTests = require('./known_flaky_tests.json');

function analyzeFlakyTests(os, failedTestTitles) {
    try {
        // Get the list of known flaky tests for the provided operating system
        const knownFlakyTestsForOS = new Set(knownFlakyTests[os] || []);

        // Filter out the known flaky tests from the failed test titles
        const newFailedTests = failedTestTitles.filter((test) => !knownFlakyTestsForOS.has(test));

        // Filter out the new flaky tests from the failed test titles
        const fixedTests = Array.from(knownFlakyTestsForOS).filter((test) => !failedTestTitles.includes(test));

        // Print the results
        if (newFailedTests.length > 0) {
            console.log(`New failed tests found on ${os}:`);
            newFailedTests.forEach((test) => console.log(`- ${test}`));
        } else {
            console.log(`No new failed tests found on ${os}.`);
        }

        if (fixedTests.length > 0) {
            console.log(`Known flaky tests fixed on ${os}:`);
            fixedTests.forEach((test) => console.log(`- ${test}`));
        } else {
            console.log(`No known flaky tests were fixed on ${os}.`);
        }
    } catch (error) {
        console.error('Error analyzing failures:', error);
    }
}

module.exports = {
    analyzeFlakyTests,
};
