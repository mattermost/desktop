// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// CI util unit tests: run with `node --test e2e/utils/github-actions.test.js`.
// Not a Playwright Electron spec (no browser/app fixtures), so it stays under e2e/utils/.

const {describe, it} = require('node:test');
const assert = require('node:assert/strict');

const {
    markE2EStatusesCancelled,
    E2E_OS_STATUS_CONTEXTS,
    E2E_POLICY_STATUS_CONTEXTS,
} = require('./github-actions');

const context = {repo: {owner: 'mattermost', repo: 'desktop'}, runId: 42};

function stubGithub() {
    const calls = [];
    return {
        calls,
        github: {
            rest: {
                repos: {
                    createCommitStatus: (params) => {
                        calls.push(params);
                        return Promise.resolve({});
                    },
                },
            },
        },
    };
}

describe('markE2EStatusesCancelled', () => {
    it('defaults to error so withdrawn coverage keeps the merge gate closed', async () => {
        const {github, calls} = stubGithub();

        await markE2EStatusesCancelled({github, context, sha: 'abc123'});

        assert.equal(calls.length, E2E_OS_STATUS_CONTEXTS.length + E2E_POLICY_STATUS_CONTEXTS.length);
        assert.ok(calls.every((call) => call.state === 'error'));
    });

    it('passes every required e2e context when the override waives E2E', async () => {
        const {github, calls} = stubGithub();

        await markE2EStatusesCancelled({
            github,
            context,
            sha: 'abc123',
            state: 'success',
            reason: 'E2E waived (E2E/Override label applied) — no tests ran',
        });

        const expected = [...E2E_OS_STATUS_CONTEXTS, ...E2E_POLICY_STATUS_CONTEXTS];
        assert.deepEqual(calls.map((call) => call.context).sort(), expected.sort());
        assert.ok(calls.every((call) => call.state === 'success'));
        assert.ok(calls.every((call) => call.description.includes('no tests ran')));
    });

    it('truncates the description to the commit status limit', async () => {
        const {github, calls} = stubGithub();

        await markE2EStatusesCancelled({github, context, sha: 'abc123', reason: 'x'.repeat(200)});

        assert.ok(calls.every((call) => call.description.length === 140));
    });

    it('does not reject when a status update fails', async () => {
        const {github} = stubGithub();
        github.rest.repos.createCommitStatus = () => Promise.reject(new Error('boom'));

        await markE2EStatusesCancelled({github, context, sha: 'abc123'});
    });
});
