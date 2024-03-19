// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

// See reference: https://support.smartbear.com/tm4j-cloud/api-docs/

const os = require('os');

const axios = require('axios');
const chalk = require('chalk');

const {getAllTests} = require('./report');

const status = {
    passed: 'Pass',
    failed: 'Fail',
    pending: 'Pending',
    skipped: 'Skip',
};

const environment = {
    chrome: 'Chrome',
    firefox: 'Firefox',
};

function getStepStateResult(steps = []) {
    return steps.reduce((acc, item) => {
        if (acc[item.state]) {
            acc[item.state] += 1;
        } else {
            acc[item.state] = 1;
        }

        return acc;
    }, {});
}

function getStepStateSummary(steps = []) {
    const result = getStepStateResult(steps);

    return Object.entries(result).map(([key, value]) => `${value} ${key}`).join(',');
}

function getZEPHYRTestCases(report) {
    return getAllTests(report.results).
        filter((item) => /^(MM-T)\w+/g.test(item.title)). // eslint-disable-line wrap-regex
        map((item) => {
            return {
                title: item.title,
                duration: item.duration,
                incrementalDuration: item.incrementalDuration,
                state: item.state,
                pass: item.pass,
                fail: item.fail,
                pending: item.pending,
            };
        }).
        reduce((acc, item) => {
            // Extract the key to exactly match with "MM-T[0-9]+"
            const key = item.title.match(/(MM-T\d+)/)[0];

            if (acc[key]) {
                acc[key].push(item);
            } else {
                acc[key] = [item];
            }

            return acc;
        }, {});
}

function saveToEndpoint(url, data) {
    return axios({
        method: 'POST',
        url,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: process.env.ZEPHYR_API_KEY,
        },
        data,
    }).catch((error) => {
        console.log('Something went wrong:', error.response.data);
        return error.response.data;
    });
}

async function getZEPHYRFolderID() {
    const {
        TYPE,
        ZEPHYR_FOLDER_ID,
        ZEPHYR_FOLDER_LINUX_REPORT,
        ZEPHYR_FOLDER_MACOS_REPORT,
        ZEPHYR_FOLDER_WIN_REPORT,
    } = process.env;
    if (TYPE === 'MASTER') {
        return ZEPHYR_FOLDER_ID;
    }
    const platform = os.platform();

    // Define Zephyr folder IDs for different run types and platforms.
    // For PR we dont generate reports.
    // Post Merge to master branch, default folderID will be used.
    const folderIDs = {
        RELEASE: {
            darwin: ZEPHYR_FOLDER_MACOS_REPORT,
            win32: ZEPHYR_FOLDER_WIN_REPORT,
            linux: ZEPHYR_FOLDER_LINUX_REPORT,
            default: ZEPHYR_FOLDER_ID,
        },
        NIGHTLY: {
            darwin: ZEPHYR_FOLDER_MACOS_REPORT,
            win32: ZEPHYR_FOLDER_WIN_REPORT,
            linux: ZEPHYR_FOLDER_LINUX_REPORT,
            default: ZEPHYR_FOLDER_ID,
        },
    };

    // Get the folder ID based on the type and platform
    const typeFolderIDs = folderIDs[TYPE];
    const folderID = typeFolderIDs?.[platform] ?? typeFolderIDs?.default ?? ZEPHYR_FOLDER_ID;

    return folderID;
}

async function createTestCycle(startDate, endDate) {
    const {
        BRANCH,
        BUILD_ID,
        JIRA_PROJECT_KEY,
        ZEPHYR_CYCLE_NAME,
    } = process.env;

    const testCycle = {
        projectKey: JIRA_PROJECT_KEY,
        name: ZEPHYR_CYCLE_NAME ? `${ZEPHYR_CYCLE_NAME} (${BUILD_ID}-${BRANCH})` : `${BUILD_ID}-${BRANCH}`,
        description: `Playwright automated test with ${BRANCH}`,
        plannedStartDate: startDate,
        plannedEndDate: endDate,
        statusName: 'Done',
        folderId: await getZEPHYRFolderID(),
    };

    const response = await saveToEndpoint('https://api.zephyrscale.smartbear.com/v2/testcycles', testCycle);
    return response.data;
}

async function createTestExecutions(report, testCycle) {
    const {
        BROWSER,
        JIRA_PROJECT_KEY,
        ZEPHYR_ENVIRONMENT_NAME,
    } = process.env;

    const testCases = getZEPHYRTestCases(report);
    const startDate = new Date(report.stats.start);
    const startTime = startDate.getTime();

    const promises = [];
    Object.entries(testCases).forEach(([key, steps], index) => {
        const testScriptResults = steps.
            sort((a, b) => a.title.localeCompare(b.title)).
            map((item) => {
                return {
                    statusName: status[item.state],
                    actualEndDate: new Date(startTime + item.incrementalDuration).toISOString(),
                    actualResult: 'Playwright automated test completed',
                };
            });

        const stateResult = getStepStateResult(steps);

        const testExecution = {
            projectKey: JIRA_PROJECT_KEY,
            testCaseKey: key,
            testCycleKey: testCycle.key,
            statusName: stateResult.passed && stateResult.passed === steps.length ? 'Pass' : 'Fail',
            testScriptResults,
            environmentName: ZEPHYR_ENVIRONMENT_NAME || environment[BROWSER] || 'Chrome',
            actualEndDate: testScriptResults[testScriptResults.length - 1].actualEndDate,
            executionTime: steps.reduce((acc, prev) => {
                acc += prev.duration; // eslint-disable-line no-param-reassign
                return acc;
            }, 0),
            comment: `Playwright automated test - ${getStepStateSummary(steps)}`,
        };

        // Temporarily log to verify cases that were being saved.
        console.log(index, key); // eslint-disable-line no-console

        promises.push(saveTestExecution(testExecution, index));
    });

    await Promise.all(promises);
    console.log('Successfully saved test cases into the Test Management System');
}

const saveTestCases = async (allReport) => {
    const {start, end} = allReport.stats;

    const testCycle = await createTestCycle(start, end);

    await createTestExecutions(allReport, testCycle);
};

const RETRY = [];

async function saveTestExecution(testExecution, index) {
    await axios({
        method: 'POST',
        url: 'https://api.zephyrscale.smartbear.com/v2/testexecutions',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: process.env.ZEPHYR_API_KEY,
        },
        data: testExecution,
    }).then(() => {
        console.log(chalk.green('Success:', index, testExecution.testCaseKey));
    }).catch((error) => {
        // Retry on 500 error code / internal server error
        if (!error.response || error.response.data.errorCode === 500) {
            if (RETRY[testExecution.testCaseKey]) {
                RETRY[testExecution.testCaseKey] += 1;
            } else {
                RETRY[testExecution.testCaseKey] = 1;
            }

            saveTestExecution(testExecution, index);
            console.log(chalk.magenta('Retry:', index, testExecution.testCaseKey, `(${RETRY[testExecution.testCaseKey]}x)`));
        } else {
            console.log(chalk.red('Error:', index, testExecution.testCaseKey, error.response.data.message));
        }
    });
}

module.exports = {
    createTestCycle,
    saveTestCases,
    createTestExecutions,
};
