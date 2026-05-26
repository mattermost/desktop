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
        // These are aggregated counts. Playwright includes retried failures in them.
        // If the exit code is 0, all tests ultimately passed — only count definitive failures.
        const exitCode = toNumber(process.env.PLAYWRIGHT_EXIT_CODE || '0');
        if (exitCode === 0) {
            return 0;
        }
        return toNumber(suite.failures) + toNumber(suite.errors);
    }

    // When no aggregated counts exist, inspect individual testcases.
    // Filter out failures that were later retried and passed.
    const cases = asArray(suite.testcase);
    const definitiveFailures = cases.filter((testcase) => {
        if (!testcase.failure && !testcase.error) {
            return false;
        }

        // If this test name ends with a retry suffix like " (retry #1)",
        // and the base test (without suffix) also appears as a passing case,
        // this failure was retried and resolved — don't count it.
        const name = testcase.name || '';
        const retryMatch = name.match(/^(.*) \(retry #\d+\)$/);
        if (retryMatch) {
            const baseName = retryMatch[1];
            const hasPassingRetry = cases.some(
                (c) => c.name === baseName && !c.failure && !c.error,
            );
            if (hasPassingRetry) {
                return false;
            }
        }
        return true;
    });
    return definitiveFailures.length;
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
