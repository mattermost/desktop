// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const fs = require('fs');
const path = require('path');

const {XMLParser} = require('fast-xml-parser');

const JUNIT_REPORT_PATH = path.join(__dirname, '..', 'test-results', 'e2e-junit.xml');

function toNumber(value) {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function asArray(value) {
    if (!value) {
        return [];
    }

    return Array.isArray(value) ? value : [value];
}

function getSuiteFailureCount(suite) {
    if (!suite || typeof suite !== 'object') {
        return 0;
    }

    if (suite.failures !== undefined || suite.errors !== undefined) {
        return toNumber(suite.failures) + toNumber(suite.errors);
    }

    return asArray(suite.testcase).filter((testcase) => testcase.failure || testcase.error).length;
}

function getFailureCountFromReport(report) {
    if (!report || typeof report !== 'object') {
        return 0;
    }

    if (report.testsuites) {
        const testsuites = report.testsuites;
        if (testsuites.failures !== undefined || testsuites.errors !== undefined) {
            return toNumber(testsuites.failures) + toNumber(testsuites.errors);
        }

        return asArray(testsuites.testsuite).reduce((total, suite) => total + getSuiteFailureCount(suite), 0);
    }

    return getSuiteFailureCount(report.testsuite);
}

function analyzeFlakyTests() {
    const exitCode = toNumber(process.env.PLAYWRIGHT_EXIT_CODE || '0');

    if (!fs.existsSync(JUNIT_REPORT_PATH)) {
        const failureCount = exitCode === 0 ? 0 : 1;
        return {
            failureCount,
            newFailedTests: new Array(failureCount).fill('unknown'),
            os: process.platform,
        };
    }

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
    });

    const report = parser.parse(fs.readFileSync(JUNIT_REPORT_PATH, 'utf8'));
    const failureCount = getFailureCountFromReport(report);

    return {
        failureCount,
        newFailedTests: new Array(failureCount).fill('failed'),
        os: process.platform,
    };
}

module.exports = {
    analyzeFlakyTests,
};
