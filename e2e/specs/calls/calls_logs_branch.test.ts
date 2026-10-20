// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {callsLogsBranch} from '../../helpers/callsLogs';

// Classifier only. These cases do not launch Electron or talk to a server,
// so they are not pinned to Calls shard 1.
test.describe('callsLogsBranch', () => {
    test(
        'treats Calls 1.12.0 and newer, including pre-releases, as the upload confirmation',
        {tag: ['@P2', '@all']},
        () => {
            expect(callsLogsBranch('1.12.0')).toBe('modern');
            expect(callsLogsBranch('1.12.0-rc1')).toBe('modern');
            expect(callsLogsBranch('1.13.2')).toBe('modern');
        },
    );

    test(
        'treats older resolved Calls versions as the seeded echo',
        {tag: ['@P2', '@all']},
        () => {
            expect(callsLogsBranch('1.11.9')).toBe('legacy');
            expect(callsLogsBranch('0.16.0')).toBe('legacy');
        },
    );

    test(
        'accepts either marker when the plugin version cannot be resolved',
        {tag: ['@P2', '@all']},
        () => {
            expect(callsLogsBranch(undefined)).toBe('unresolved');
            expect(callsLogsBranch(null)).toBe('unresolved');
            expect(callsLogsBranch('')).toBe('unresolved');
        },
    );
});
