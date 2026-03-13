// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable no-console */
const path = require('path');

const {MOCHAWESOME_REPORT_DIR} = require('./constants');
const {
    generateShortSummary,
    readJsonFromFile,
} = require('./report');

function analyzeFlakyTests() {
    const os = process.platform;
    try {
        const jsonReport = readJsonFromFile(path.join(MOCHAWESOME_REPORT_DIR, 'mochawesome.json'));
        const {failedFullTitles} = generateShortSummary(jsonReport);
        return {newFailedTests: failedFullTitles, os};
    } catch (error) {
        console.error('Error analyzing failures:', error);
        return {};
    }
}

module.exports = {
    analyzeFlakyTests,
};
