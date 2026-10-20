// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const {isVersionAtLeast} = require('./semver');

const CALLS_LOG_UPLOAD_MARKER = 'Call logs uploaded';
const CALLS_LOG_SEED_MARKER = 'pre-seeded call log for MM-T5590';

// Same threshold as CALLS_DISABLED_WHILE_CONNECTING in callsWidget.ts.
const CALLS_LOGS_MODERN_VERSION = '1.12.0';

/**
 * Which /call logs post body MM-T5590 should accept.
 * An unresolved version accepts either marker; a resolved older plugin accepts only the seed.
 * @param {string | null | undefined} version
 * @return {'modern' | 'legacy' | 'unresolved'}
 */
function callsLogsBranch(version) {
    if (!version) {
        return 'unresolved';
    }
    return isVersionAtLeast(version, CALLS_LOGS_MODERN_VERSION) ? 'modern' : 'legacy';
}

module.exports = {
    CALLS_LOG_UPLOAD_MARKER,
    CALLS_LOG_SEED_MARKER,
    CALLS_LOGS_MODERN_VERSION,
    callsLogsBranch,
};
