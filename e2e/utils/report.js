// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console, camelcase */

const os = require('os');

const axios = require('axios');
const fse = require('fs-extra');

const {MOCHAWESOME_REPORT_DIR} = require('./constants');

const package = require('../../package.json');
const e2ePackage = require('../package.json');

const MAX_FAILED_TITLES = 5;

let incrementalDuration = 0;

function getAllTests(results) {
    const tests = [];
    results.forEach((result) => {
        result.tests.forEach((test) => {
            incrementalDuration += test.duration;
            tests.push({...test, incrementalDuration});
        });

        if (result.suites.length > 0) {
            getAllTests(result.suites).forEach((test) => tests.push(test));
        }
    });

    return tests;
}

function generateStatsFieldValue(stats, failedFullTitles) {
    let statsFieldValue = `
| Key | Value |
|:---|:---|
| Passing Rate | ${stats.passPercent.toFixed(2)}% |
| Duration | ${(stats.duration / (60 * 1000)).toFixed(2)} mins |
| Suites | ${stats.suites} |
| Tests | ${stats.tests} |
| :white_check_mark: Passed | ${stats.passes} |
| :x: Failed | ${stats.failures} |
| :fast_forward: Skipped | ${stats.skipped} |
`;

    // If present, add full title of failing tests.
    // Only show per maximum number of failed titles with the last item as "more..." if failing tests are more than that.
    let failedTests;
    if (failedFullTitles && failedFullTitles.length > 0) {
        const re = /[:'"\\]/gi;
        const failed = failedFullTitles;
        if (failed.length > MAX_FAILED_TITLES) {
            failedTests = failed.slice(0, MAX_FAILED_TITLES - 1).map((f) => `- ${f.replace(re, '')}`).join('\n');
            failedTests += '\n- more...';
        } else {
            failedTests = failed.map((f) => `- ${f.replace(re, '')}`).join('\n');
        }
    }

    if (failedTests) {
        statsFieldValue += '###### Failed Tests:\n' + failedTests;
    }

    return statsFieldValue;
}

function generateShortSummary(report) {
    const {results, stats} = report;
    const tests = getAllTests(results);

    const failedFullTitles = tests.filter((t) => t.fail).map((t) => t.fullTitle);
    const statsFieldValue = generateStatsFieldValue(stats, failedFullTitles);

    return {
        stats,
        statsFieldValue,
        failedFullTitles,
    };
}

function removeOldGeneratedReports() {
    [
        'all.json',
        'summary.json',
        'mochawesome.html',
    ].forEach((file) => fse.removeSync(`${MOCHAWESOME_REPORT_DIR}/${file}`));
}

function writeJsonToFile(jsonObject, filename, dir) {
    fse.writeJson(`${dir}/${filename}`, jsonObject).
        then(() => console.log('Successfully written:', filename)).
        catch((err) => console.error(err));
}

function readJsonFromFile(file) {
    try {
        return fse.readJsonSync(file);
    } catch (err) {
        return {err};
    }
}

function getOS() {
    switch (process.platform) {
    case 'darwin':
        return 'macOS';
    case 'win32':
        return 'Windows';
    case 'linux':
        return 'Linux';
    default:
        return 'Unknown';
    }
}

function getEnvironmentValues() {
    return {
        playwrightVersion: e2ePackage.dependencies.playwright,
        electronVersion: package.devDependencies.electron,
        osName: getOS(),
        osVersion: os.release(),
        nodeVersion: process.version,
    };
}

const result = [
    {status: 'Passed', priority: 'none', cutOff: 100, color: '#43A047'},
    {status: 'Failed', priority: 'low', cutOff: 98, color: '#FFEB3B'},
    {status: 'Failed', priority: 'medium', cutOff: 95, color: '#FF9800'},
    {status: 'Failed', priority: 'high', cutOff: 0, color: '#F44336'},
];

function generateTestReport(summary, isUploadedToS3, reportLink, testCycleKey) {
    const {
        FULL_REPORT,
        TEST_CYCLE_LINK_PREFIX,
    } = process.env;
    const {statsFieldValue, stats} = summary;
    const {
        playwrightVersion,
        electronVersion,
        osName,
        osVersion,
        nodeVersion,
    } = getEnvironmentValues();

    let testResult;
    for (let i = 0; i < result.length; i++) {
        if (stats.passPercent >= result[i].cutOff) {
            testResult = result[i];
            break;
        }
    }

    const title = generateTitle();
    const envValue = `playwright@${playwrightVersion} | node@${nodeVersion} | electron@${electronVersion} | ${osName}@${osVersion}`;

    if (FULL_REPORT === 'true') {
        let reportField;
        if (isUploadedToS3) {
            reportField = {
                short: false,
                title: 'Test Report',
                value: `[Link to the report](${reportLink})`,
            };
        }

        let testCycleField;
        if (testCycleKey) {
            testCycleField = {
                short: false,
                title: 'Test Execution',
                value: `[Recorded test executions](${TEST_CYCLE_LINK_PREFIX}${testCycleKey})`,
            };
        }

        return {
            username: 'Playwright UI Test',
            icon_url: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
            attachments: [{
                color: testResult.color,
                author_name: 'Desktop End-to-end Testing',
                author_icon: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
                author_link: 'https://www.mattermost.com',
                title,
                fields: [
                    {
                        short: false,
                        title: 'Environment',
                        value: envValue,
                    },
                    reportField,
                    testCycleField,
                    {
                        short: false,
                        title: `Key metrics (required support: ${testResult.priority})`,
                        value: statsFieldValue,
                    },
                ],
            }],
        };
    }

    let quickSummary = `${stats.passPercent.toFixed(2)}% (${stats.passes}/${stats.tests}) in ${stats.suites} suites`;
    if (isUploadedToS3) {
        quickSummary = `[${quickSummary}](${reportLink})`;
    }

    let testCycleLink = '';
    if (testCycleKey) {
        testCycleLink = testCycleKey ? `| [Recorded test executions](${TEST_CYCLE_LINK_PREFIX}${testCycleKey})` : '';
    }

    return {
        username: 'Playwright UI Test',
        icon_url: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
        attachments: [{
            color: testResult.color,
            author_name: 'Desktop End-to-end Testing',
            author_icon: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
            author_link: 'https://www.mattermost.com/',
            title,
            text: `${quickSummary} | ${(stats.duration / (60 * 1000)).toFixed(2)} mins ${testCycleLink}\n${envValue}`,
        }],
    };
}

function generateTitle() {
    const {
        BRANCH,
        DESKTOP_VERSION,
        PULL_REQUEST,
        RELEASE_VERSION,
        SERVER_VERSION,
        TYPE,
    } = process.env;

    let releaseVersion = '';
    if (RELEASE_VERSION) {
        releaseVersion = ` for ${RELEASE_VERSION}`;
    }

    let title;

    switch (TYPE) {
    case 'PR':
        title = `E2E for Pull Request Build: [${BRANCH}](${PULL_REQUEST})`;
        break;
    case 'RELEASE':
        title = `E2E for Release Build${releaseVersion}`;
        break;
    case 'NIGHTLY':
        title = 'E2E for Master Nightly Build';
        break;
    case 'MASTER':
        title = 'E2E for Post Merge to Master';
        break;
    case 'MANUAL':
        title = `E2E for Manually triggered for ${BRANCH}`;
        break;
    case 'CMT':
        title = `Compatibility Matrix Testing Report for Server v${SERVER_VERSION} and Desktop version v${DESKTOP_VERSION}`;
        break;
    default:
        title = 'E2E for Build$';
    }

    return title;
}

async function sendReport(name, url, data) {
    const requestOptions = {method: 'POST', url, data};

    try {
        const response = await axios(requestOptions);

        if (response.data) {
            console.log(`Successfully sent ${name}.`);
        }
        return response;
    } catch (er) {
        console.log(`Something went wrong while sending ${name}.`, er);
        return false;
    }
}

module.exports = {
    generateShortSummary,
    generateTestReport,
    getAllTests,
    removeOldGeneratedReports,
    sendReport,
    readJsonFromFile,
    writeJsonToFile,
};
