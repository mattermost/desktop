// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

/*
 * This is used for saving artifacts to AWS S3, sending data to automation dashboard and
 * publishing quick summary to community channels.
 *
 * Usage: [ENV] node save_report.js
 *
 * Environment variables:
 *   BRANCH=[branch]            : Branch identifier from CI
 *   BUILD_ID=[build_id]        : Build identifier from CI
 *   BUILD_TAG=[build_tag]      : Docker image used to run the test
 *
 *   For saving artifacts to AWS S3
 *      - AWS_S3_BUCKET, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
 *   For saving test cases to Test Management
 *      - ZEPHYR_ENABLE=true|false
 *      - ZEPHYR_API_KEY=[api_key]
 *      - JIRA_PROJECT_KEY=[project_key], e.g. "MM",
 *      - ZEPHYR_FOLDER_ID=[folder_id], e.g. 847997
 *   For sending hooks to Mattermost channels
 *      - FULL_REPORT, WEBHOOK_URL and DIAGNOSTIC_WEBHOOK_URL
 *   Test type
 *      - TYPE=[type], e.g. "MASTER", "PR", "RELEASE", "CLOUD"
 */

const fs = require('fs');
const path = require('path');

const generator = require('mochawesome-report-generator');

const {saveArtifacts} = require('./utils/artifacts');
const {MOCHAWESOME_REPORT_DIR} = require('./utils/constants');
const {
    generateShortSummary,
    generateTestReport,
    removeOldGeneratedReports,
    sendReport,
    readJsonFromFile,
    writeJsonToFile,
} = require('./utils/report');
const {createTestCycle, createTestExecutions} = require('./utils/test_cases');

require('dotenv').config();

const saveReport = async () => {
    const {
        BRANCH,
        BUILD_ID,
        BUILD_TAG,
        ZEPHYR_ENABLE,
        ZEPHYR_CYCLE_KEY,
        TYPE,
        WEBHOOK_URL,
    } = process.env;

    removeOldGeneratedReports();

    // Import
    const jsonReport = readJsonFromFile(path.join(MOCHAWESOME_REPORT_DIR, 'mochawesome.json'));

    // Generate the html report file
    await generator.create(
        jsonReport,
        {
            reportDir: MOCHAWESOME_REPORT_DIR,
            reportTitle: `Desktop E2E - Build: ${BUILD_ID} Branch: ${BRANCH} Tag: ${BUILD_TAG}`,
        },
    );

    // Generate short summary, write to file and then send report via webhook
    const {stats, statsFieldValue} = generateShortSummary(jsonReport);
    const summary = {stats, statsFieldValue};
    console.log(summary);
    writeJsonToFile(summary, 'summary.json', MOCHAWESOME_REPORT_DIR);

    const result = await saveArtifacts();
    if (result && result.success) {
        console.log('Successfully uploaded artifacts to S3:', result.reportLink);

        // save the report link to a file For CI to use
        fs.writeFileSync('report-link.txt', result.reportLink);
    }

    // Create or use an existing test cycle
    let testCycle = {};
    if (ZEPHYR_ENABLE === 'true') {
        const {start, end} = jsonReport.stats;
        testCycle = ZEPHYR_CYCLE_KEY ? {key: ZEPHYR_CYCLE_KEY} : await createTestCycle(start, end);
    }

    // Send test report to "QA: UI Test Automation" channel via webhook
    if (TYPE && TYPE !== 'NONE' && WEBHOOK_URL) {
        const data = generateTestReport(summary, result && result.success, result && result.reportLink, testCycle.key);
        await sendReport('summary report to Community channel', WEBHOOK_URL, data);
    }

    // Save test cases to Test Management
    if (ZEPHYR_ENABLE === 'true') {
        await createTestExecutions(jsonReport, testCycle);
    }
};

saveReport();
