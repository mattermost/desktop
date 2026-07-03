// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const fs = require('fs');
const path = require('path');
const {createRequire} = require('module');

const JUNIT_REPORT_PATH = path.join(__dirname, '..', 'test-results', 'e2e-junit.xml');

function getXMLParserClass() {
    const packageCandidates = [
        path.join(__dirname, '..', 'package.json'),
        path.join(__dirname, '..', '..', 'package.json'),
    ];

    for (const packageJson of packageCandidates) {
        try {
            const {XMLParser} = createRequire(packageJson)('fast-xml-parser');
            return XMLParser;
        } catch (error) {
            const isModuleNotFound =
                error &&
                (error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_MODULE_NOT_FOUND');
            if (!isModuleNotFound) {
                throw error;
            }

            // try the other package root (e2e/ vs repo root)
        }
    }

    throw new Error('fast-xml-parser is not installed. Run npm ci in the repo root and e2e/.');
}

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

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
        } else {
            const baseName = name;
            const retryPattern = new RegExp(`^${escapeRegex(baseName)} \\(retry #\\d+\\)$`);
            const hasPassingRetry = cases.some(
                (c) => Boolean(c.name && retryPattern.test(c.name)) &&
                    c.failure === undefined && c.error === undefined,
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

/**
 * Collect every testcase across every suite into a flat array.
 */
function collectAllCases(report) {
    if (!report || typeof report !== 'object') {
        return [];
    }
    const suites = report.testsuites ?
        asArray(report.testsuites.testsuite) :
        asArray(report.testsuite);
    const all = [];
    for (const suite of suites) {
        if (!suite || typeof suite !== 'object') {
            continue;
        }
        for (const tc of asArray(suite.testcase)) {
            all.push(tc);
        }
    }
    return all;
}

/**
 * Compute pass / fail / skip / total at the UNIQUE-TEST level (collapsing
 * retries into a single outcome per test, mirroring how Playwright's HTML
 * report reports stats). A test that failed once then passed on retry counts
 * once as "passed" — not as both.
 */
function getOutcomeCounts(report) {
    const cases = collectAllCases(report);
    if (cases.length === 0) {
        return {passed: 0, failed: 0, skipped: 0, total: 0};
    }

    // Group every case (including retries) by its base name.
    const byBase = new Map();
    for (const tc of cases) {
        const name = tc.name || '';
        const m = name.match(/^(.*) \(retry #\d+\)$/);
        const base = m ? m[1] : name;
        if (!byBase.has(base)) {
            byBase.set(base, []);
        }
        byBase.get(base).push(tc);
    }

    let passed = 0;
    let failed = 0;
    let skipped = 0;
    for (const attempts of byBase.values()) {
        // Empty self-closing tags parse to "" — check for property presence.
        const anyPass = attempts.some(
            (tc) =>
                tc.failure === undefined &&
                tc.error === undefined &&
                tc.skipped === undefined,
        );
        const anyFail = attempts.some(
            (tc) => tc.failure !== undefined || tc.error !== undefined,
        );
        const allSkipped = attempts.every((tc) => tc.skipped !== undefined);

        if (anyPass) {
            passed += 1;
        } else if (anyFail) {
            failed += 1;
        } else if (allSkipped) {
            skipped += 1;
        }
    }

    return {passed, failed, skipped, total: passed + failed + skipped};
}

function analyzeFlakyTests() {
    const exitCode = toNumber(process.env.PLAYWRIGHT_EXIT_CODE || '0');
    const hasJunit = fs.existsSync(JUNIT_REPORT_PATH);

    if (!hasJunit) {
        if (process.env.JOB_STATUS === 'cancelled') {
            return {
                failureCount: 0,
                passCount: 0,
                skipCount: 0,
                totalCount: 0,
                newFailedTests: [],
                os: process.platform,
                testStatus: 'error',
            };
        }

        const failureCount = exitCode === 0 ? 0 : 1;
        return {
            failureCount,
            passCount: 0,
            skipCount: 0,
            totalCount: failureCount,
            newFailedTests: new Array(failureCount).fill('unknown'),
            os: process.platform,
            testStatus: failureCount > 0 ? 'failure' : 'success',
        };
    }

    const XMLParser = getXMLParserClass();
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
    });

    const report = parser.parse(fs.readFileSync(JUNIT_REPORT_PATH, 'utf8'));
    const failureCount = getFailureCountFromReport(report);
    const outcomes = getOutcomeCounts(report);

    // `failureCount` is the authoritative number (it applies the retry-pass
    // filter + honours PLAYWRIGHT_EXIT_CODE). When they disagree (rare —
    // summary-only junit, or exit-code 0 with stale aggregates), trust
    // `failureCount` and reconcile the rest.
    const reconciledFailed = failureCount;
    const reconciledPassed = Math.max(0, outcomes.total - reconciledFailed - outcomes.skipped);
    const testStatus = reconciledFailed > 0 ? 'failure' : 'success';

    return {
        failureCount,
        passCount: reconciledPassed,
        skipCount: outcomes.skipped,
        totalCount: reconciledFailed + reconciledPassed + outcomes.skipped,
        newFailedTests: new Array(failureCount).fill('failed'),
        os: process.platform,
        testStatus,
    };
}

module.exports = {
    analyzeFlakyTests,
};
