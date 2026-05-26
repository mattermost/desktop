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

    // Short-circuit on the common "no failures" case: if the suite advertises
    // 0 failures/errors AND has no testcase entries, there's nothing to walk.
    const aggregatedFailures = toNumber(suite.failures) + toNumber(suite.errors);
    const cases = asArray(suite.testcase);
    if (aggregatedFailures === 0 && cases.length === 0) {
        return 0;
    }

    // If the run ultimately succeeded (exit code 0), the only failures present
    // are retries that later passed — don't count any of them.
    const exitCode = toNumber(process.env.PLAYWRIGHT_EXIT_CODE || '0');
    if (exitCode === 0) {
        return 0;
    }

    // Walk testcases and filter out failures that were later retried and passed.
    // Playwright's JUnit aggregate `failures` attribute over-counts these, so
    // never trust it as a final number.
    const definitiveFailures = cases.filter((testcase) => {
        // Empty self-closing elements (<failure/>) parse to "" — check for
        // presence rather than truthiness.
        if (testcase.failure === undefined && testcase.error === undefined) {
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
                (c) => c.name === baseName && c.failure === undefined && c.error === undefined,
            );
            if (hasPassingRetry) {
                return false;
            }
        }
        return true;
    });

    // If aggregate said failures>0 but we couldn't see any testcases (rare —
    // summary-only reporter), fall back to the aggregate so we don't silently
    // report 0 when something did fail.
    if (definitiveFailures.length === 0 && cases.length === 0 && aggregatedFailures > 0) {
        return aggregatedFailures;
    }

    return definitiveFailures.length;
}

function getFailureCountFromReport(report) {
    if (!report || typeof report !== 'object') {
        return 0;
    }

    if (report.testsuites) {
        const testsuites = report.testsuites;

        // Always walk the per-suite/testcase tree. The top-level aggregate
        // `failures` / `errors` attributes include retried-and-passed tests, so
        // returning them directly would over-count flaky tests as failures.
        // getSuiteFailureCount() filters retries against passing reruns and
        // honors PLAYWRIGHT_EXIT_CODE.
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
