// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const fs = require('fs');
const path = require('path');

const {XMLParser} = require('fast-xml-parser');

const JUNIT_REPORT_PATH = path.join(__dirname, '..', 'test-results', 'e2e-junit.xml');

const MIGRATED_SPEC_FILES = [
    'calls/calls_functionality.test.ts',
    'downloads/video_download.test.ts',
    'focus/app_switch_focus.test.ts',
    'mattermost/alt_enter.test.ts',
    'mattermost/bookmarks.test.ts',
    'mattermost/context_menu.test.ts',
    'mattermost/custom_groups.test.ts',
    'menu_bar/devtools_current_server.test.ts',
    'notification_trigger/desktop_notification_delivery.test.ts',
    'notification_trigger/dock_bounce.test.ts',
    'notification_trigger/flash_taskbar.test.ts',
    'settings/tray_icon_hide.test.ts',
    'startup/cmd_tab_restore.test.ts',
    'startup/window_reposition.test.ts',
];

const EXPECTED_SKIP_PATTERNS = [
    /macos only/i,
    /linux only/i,
    /windows only/i,
    /not supported on linux/i,
    /linux not supported/i,
    /flash taskbar is windows\/linux only/i,
    /tray icon setting applies to macos and linux only/i,
    /bookmarks menu not available/i,
    /calls plugin\/widget not available/i,
    /user groups not available/i,
    /product switcher not available/i,
    /customizeyourexperiencetour not available/i,
    /run_policy_e2e/i,
];

function asArray(value) {
    if (!value) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}

function getSkipMessage(testcase) {
    const skipped = testcase.skipped;
    if (!skipped) {
        return '';
    }
    if (typeof skipped === 'string') {
        return skipped;
    }
    return skipped.message || skipped['#text'] || '';
}

function isMigratedSpec(classname) {
    const normalized = String(classname || '').replace(/\\/g, '/');
    return MIGRATED_SPEC_FILES.some((file) => normalized.endsWith(file));
}

function isExpectedSkip(message) {
    return EXPECTED_SKIP_PATTERNS.some((pattern) => pattern.test(message));
}

function auditMigratedSkips() {
    if (!fs.existsSync(JUNIT_REPORT_PATH)) {
        return {
            migratedSkipped: [],
            unexpectedSkipped: [],
            summary: 'No JUnit report found — skip audit skipped.',
        };
    }

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
    });
    const report = parser.parse(fs.readFileSync(JUNIT_REPORT_PATH, 'utf8'));
    const suites = report.testsuites ?
        asArray(report.testsuites.testsuite) :
        asArray(report.testsuite);

    const byBase = new Map();
    for (const suite of suites) {
        if (!isMigratedSpec(suite.classname || suite.name)) {
            continue;
        }
        for (const testcase of asArray(suite.testcase)) {
            const name = testcase.name || '';
            const retryMatch = name.match(/^(.*) \(retry #\d+\)$/);
            const base = retryMatch ? retryMatch[1] : name;
            if (!byBase.has(base)) {
                byBase.set(base, []);
            }
            byBase.get(base).push({suite, testcase});
        }
    }

    const migratedSkipped = [];
    const unexpectedSkipped = [];

    for (const [baseName, attempts] of byBase.entries()) {
        const allSkipped = attempts.every((entry) => entry.testcase.skipped !== undefined);
        if (!allSkipped) {
            continue;
        }

        const message = getSkipMessage(attempts[0].testcase);
        const entry = {
            name: baseName,
            file: attempts[0].suite.classname || attempts[0].suite.name || 'unknown',
            message,
        };
        migratedSkipped.push(entry);
        if (!isExpectedSkip(message)) {
            unexpectedSkipped.push(entry);
        }
    }

    const lines = [
        `Migrated-spec skips: ${migratedSkipped.length}`,
        `Unexpected migrated-spec skips: ${unexpectedSkipped.length}`,
    ];
    if (unexpectedSkipped.length > 0) {
        lines.push('', 'Unexpected skips (migrated specs only):');
        for (const entry of unexpectedSkipped) {
            lines.push(`- ${entry.name}: ${entry.message || '(no message)'}`);
        }
    }

    return {
        migratedSkipped,
        unexpectedSkipped,
        summary: lines.join('\n'),
    };
}

module.exports = {
    auditMigratedSkips,
    MIGRATED_SPEC_FILES,
};
