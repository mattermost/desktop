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
    try {
        const jsonReport = readJsonFromFile(path.join(MOCHAWESOME_REPORT_DIR, 'mochawesome.json'));
        const {failedFullTitles} = generateShortSummary(jsonReport);

        // Define platform mapping
        const platforms = {
            linux: 'linux',
            macos: 'darwin',
            windows: 'win32'
        };

        let results = {
            linux: "Linux Results:\n",
            macos: "macOS Results:\n",
            windows: "Windows Results:\n"
        };

        let newFailedTests = [];

        for (const [key, osName] of Object.entries(platforms)) {
            const knownFlakyTestsForOS = new Set(knownFlakyTests[osName] || []);

            // Instead of filtering, assume all failed tests belong to all OSes
            const failedTestsForOS = failedFullTitles;
            const newFailures = failedTestsForOS.filter((test) => !knownFlakyTestsForOS.has(test));

            results[key] += failedTestsForOS.length
                ? failedTestsForOS.join('\n')
                : "All stable tests passed.";

            newFailedTests = [...newFailedTests, ...newFailures];

            console.log(`Analyzing ${key} tests...`);
            console.log(`Results for ${key}:`, results[key]); // Debug log
        }

        return {
            COMMENT_BODY_LINUX: results.linux || "No results for Linux.",
            COMMENT_BODY_MACOS: results.macos || "No results for macOS.",
            COMMENT_BODY_WINDOWS: results.windows || "No results for Windows.",
            newFailedTests
        };
    } catch (error) {
        console.error("Error analyzing flaky tests:", error);
        return {
            COMMENT_BODY_LINUX: "Error analyzing Linux tests.",
            COMMENT_BODY_MACOS: "Error analyzing macOS tests.",
            COMMENT_BODY_WINDOWS: "Error analyzing Windows tests.",
            newFailedTests: []
        };
    }
}

module.exports = { analyzeFlakyTests };
