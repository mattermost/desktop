// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable no-console -- Logging is intentional in CI utility scripts */

/**
 * Fold per-lane AI triage verdicts for a CMT run into one verdict for the
 * channel post and the `e2e/compatibility-matrix-testing` commit status.
 *
 * Toolkit verdict semantics (mattermost-test-automation-toolkit
 * e2e-test-triage): SUCCESS = every failure cleared (flaky, failed in
 * master, other PRs, Infra failure), FAILURE = blocking failures remain
 * (likely a real bug), ACTION_REQUIRED = triage could not settle it (an
 * Infra-failure-heavy run, missing reports, too little evidence). A lane
 * with no verdict was never triaged and counts as unknown — unknown is
 * never green and never plain red.
 */

const PLATFORM_EMOJI = {
    linux: '🐧',
    macos: '🍎',
    windows: '🪟',
    unknown: '❔',
};

const PLATFORM_LABEL = {
    linux: 'Linux',
    macos: 'macOS',
    windows: 'Windows',
    unknown: 'Other',
};

function laneKey(lane) {
    return `${lane?.platform || ''}|${lane?.serverVersion || ''}`;
}

function toCount(value) {
    const n = Number.parseInt(value, 10);
    return Number.isInteger(n) && n > 0 ? n : 0;
}

function normalizeVerdict(value) {
    const verdict = String(value || '').trim().toUpperCase();
    return ['SUCCESS', 'FAILURE', 'ACTION_REQUIRED'].includes(verdict) ? verdict : '';
}

function normalizeLane(lane) {
    return {
        platform: lane?.platform || 'unknown',
        serverVersion: lane?.serverVersion || '',
        verdict: normalizeVerdict(lane?.verdict),
        blocking: toCount(lane?.blocking),
        exonerated: toCount(lane?.exonerated),
        description: String(lane?.description || ''),
    };
}

/**
 * @param {Object} stats - TSIO test_stats ({passed, failed, flaky, skipped})
 * @returns {{passed: number, failed: number, skipped: number}}
 */
function displayTotals(stats = {}) {
    return {
        passed: (stats.passed ?? 0) + (stats.flaky ?? 0),
        failed: stats.failed ?? 0,
        skipped: stats.skipped ?? 0,
    };
}

/**
 * @param {Object} params
 * @param {Array<{platform: string, serverVersion: string, verdict?: string, blocking?: number|string, exonerated?: number|string, description?: string}>} params.lanes - verdict records uploaded by the triage lanes
 * @param {Array<{platform: string, server: string}>} params.expectedLanes - triage matrix lanes (matrix.server is the server version)
 * @param {boolean} params.expectTriage - true when some leg or the summary failed, so triage should have judged every lane
 * @param {Object} [params.stats] - TSIO test_stats for the whole CMT group
 * @param {boolean} [params.upstreamJobsSucceeded]
 * @returns {{state: 'green'|'red'|'yellow', kind: string, commitStatusState: string, statusDescription: string, blockingLegs: Array, clearedLegs: Array, unknownLegs: Array, clearedCount: number, blockingCount: number, note: string}}
 */
function foldCmtVerdicts({lanes = [], expectedLanes = [], expectTriage = false, stats = {}, upstreamJobsSucceeded = true}) {
    const {passed, failed, skipped} = displayTotals(stats);
    const countsLine = `${passed} passed, ${failed} failed, ${skipped} skipped`;

    const base = {
        blockingLegs: [],
        clearedLegs: [],
        unknownLegs: [],
        clearedCount: 0,
        blockingCount: 0,
        note: '',
    };

    if (!expectTriage) {
        if (!upstreamJobsSucceeded) {
            return {
                ...base,
                state: 'yellow',
                kind: 'untriaged-upstream-failure',
                commitStatusState: 'error',
                statusDescription: 'CI job failed outside tracked tests; triage did not run',
                note: 'A CI job failed outside tracked tests (install/build/teardown) and triage did not run.',
            };
        }
        if (failed > 0) {
            return {
                ...base,
                state: 'yellow',
                kind: 'untriaged-failures',
                commitStatusState: 'error',
                statusDescription: 'Test failures present but AI triage did not run — needs investigation',
                note: 'Test failures are present but AI triage did not run, so nothing is cleared as flaky.',
            };
        }
        return {
            ...base,
            state: 'green',
            kind: 'passed',
            commitStatusState: 'success',
            statusDescription: countsLine,
        };
    }

    const byKey = new Map();
    for (const lane of lanes || []) {
        const normalized = normalizeLane(lane);
        byKey.set(laneKey(normalized), normalized);
    }

    const result = {...base};
    if (!expectedLanes || expectedLanes.length === 0) {
        return {
            ...result,
            state: 'yellow',
            kind: 'no-triage-lanes',
            commitStatusState: 'error',
            statusDescription: 'AI triage had no lanes to judge — needs investigation',
            note: 'Triage was expected but the CMT matrix produced no lanes to judge.',
        };
    }

    for (const expected of expectedLanes) {
        const leg = {platform: expected.platform || 'unknown', serverVersion: expected.server || ''};
        const record = byKey.get(laneKey(leg));
        if (!record || !record.verdict) {
            result.unknownLegs.push({...leg, reason: 'not triaged'});
        } else if (record.verdict === 'SUCCESS') {
            result.clearedLegs.push({...leg, exonerated: record.exonerated});
            result.clearedCount += record.exonerated;
        } else if (record.verdict === 'FAILURE') {
            result.blockingLegs.push({...leg, blocking: record.blocking});
            result.blockingCount += record.blocking;
        } else {
            result.unknownLegs.push({...leg, reason: 'triage needs investigation'});
        }
    }

    if (result.blockingLegs.length > 0) {
        const blocking = result.blockingCount > 0 ? `${result.blockingCount} blocking failure${result.blockingCount === 1 ? '' : 's'}` : 'Blocking failures';
        return {
            ...result,
            state: 'red',
            kind: 'blocking',
            commitStatusState: 'failure',
            statusDescription: `${blocking} after AI triage — likely bug · ${countsLine}`,
        };
    }

    if (result.unknownLegs.length > 0) {
        return {
            ...result,
            state: 'yellow',
            kind: 'inconclusive',
            commitStatusState: 'error',
            statusDescription: `AI triage inconclusive for ${result.unknownLegs.length} leg${result.unknownLegs.length === 1 ? '' : 's'} — needs investigation`,
        };
    }

    const flaky = failed > 0 || result.clearedCount > 0;
    return {
        ...result,
        state: 'green',
        kind: flaky ? 'flaky' : 'passed',
        commitStatusState: 'success',
        statusDescription: flaky ? `Flaky — AI triage cleared all failures · ${countsLine}` : countsLine,
    };
}

function formatLeg(leg) {
    const emoji = PLATFORM_EMOJI[leg.platform] || PLATFORM_EMOJI.unknown;
    const name = PLATFORM_LABEL[leg.platform] || PLATFORM_LABEL.unknown;
    return `${emoji} ${name} Server \`${leg.serverVersion}\``;
}

function formatLegList(legs, render) {
    const shown = legs.slice(0, 5).map(render).join('; ');
    return legs.length > 5 ? `${shown}; …and ${legs.length - 5} more` : shown;
}

/**
 * Short channel message for the folded CMT verdict — no per-leg table.
 *
 * @param {Object} params
 * @param {Object} params.fold - result of foldCmtVerdicts
 * @param {Object} params.compositeIdentity
 * @param {Object} [params.stats] - TSIO test_stats for the whole CMT group
 * @param {string} [params.reportUrl]
 * @param {string} [params.runUrl]
 * @returns {string}
 */
function formatCmtVerdictMessage({fold, compositeIdentity, stats = {}, reportUrl, runUrl}) {
    const {passed, failed, skipped} = displayTotals(stats);
    const branch = (compositeIdentity?.branch || '').replace(/^refs\/(heads|tags)\//, '');
    const shortSha = (compositeIdentity?.commit_sha || '').slice(0, 7);

    const titles = {
        passed: ':green_circle: **Desktop CMT — passed**',
        flaky: ':green_circle: **Desktop CMT — flaky, no bug found**',
        blocking: ':red_circle: **Desktop CMT — likely bug**',
    };
    const title = titles[fold.kind] || ':yellow_circle: **Desktop CMT — needs investigation**';

    const lines = [title];
    const meta = [
        branch ? `Branch: \`${branch}\`` : '',
        shortSha ? `Commit: \`${shortSha}\`` : '',
    ].filter(Boolean).join(' · ');
    if (meta) {
        lines.push(meta);
    }

    if (fold.kind === 'blocking') {
        const legs = formatLegList(fold.blockingLegs, (leg) =>
            `${formatLeg(leg)}${leg.blocking > 0 ? ` — ${leg.blocking} blocking` : ''}`);
        lines.push(`Blocking after AI triage: ${legs}`);
    } else if (fold.kind === 'flaky') {
        const cleared = fold.clearedLegs.length;
        const clearedCount = fold.clearedCount > 0 ? `, ${fold.clearedCount} cleared by triage` : '';
        lines.push(`AI triage cleared every failing leg (${cleared} leg${cleared === 1 ? '' : 's'}${clearedCount}: flaky / failed in master / Infra failure)`);
    } else if (fold.state === 'yellow') {
        if (fold.unknownLegs.length > 0) {
            const legs = formatLegList(fold.unknownLegs, (leg) => `${formatLeg(leg)} (${leg.reason})`);
            lines.push(`AI triage could not settle: ${legs} — not counted as flaky or as a bug`);
        } else if (fold.note) {
            lines.push(fold.note);
        }
    }

    lines.push(`**${passed} passed** · ${failed} failed · ${skipped} skipped`);

    const links = [
        reportUrl ? `[Full report](${reportUrl})` : '',
        runUrl ? `[Workflow run](${runUrl})` : '',
    ].filter(Boolean).join(' · ');
    if (links) {
        lines.push(`➡️ ${links}`);
    }

    return lines.join('\n') + '\n';
}

module.exports = {
    laneKey,
    normalizeVerdict,
    foldCmtVerdicts,
    formatCmtVerdictMessage,
    displayTotals,
};
