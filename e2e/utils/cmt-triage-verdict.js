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
 * (needs investigation), ACTION_REQUIRED = triage could not settle it (an
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

// The toolkit's per-test labels, most severe first: a test failing in several lanes takes the most severe one.
const LABEL_ORDER = ['app bug', 'caused by PR', 'needs investigation', 'out of date', 'fixed on main', 'server compat', 'test bug', 'broken on main', 'flaky'];

function labelRank(label) {
    const i = LABEL_ORDER.indexOf(label);
    return i === -1 ? LABEL_ORDER.indexOf('needs investigation') : i;
}

function normalizeFinding(row) {
    if (!row || typeof row.title !== 'string' || typeof row.file !== 'string' || typeof row.label !== 'string') {
        return null;
    }
    return {
        title: row.title,
        fullTitle: typeof row.full_title === 'string' && row.full_title ? row.full_title : row.title,
        file: row.file,
        label: row.label,
        blocking: row.blocking === true,
        explanation: typeof row.explanation === 'string' && row.explanation ? row.explanation : null,
    };
}

function normalizeLane(lane) {
    return {
        platform: lane?.platform || 'unknown',
        serverVersion: lane?.serverVersion || '',
        verdict: normalizeVerdict(lane?.verdict),
        blocking: toCount(lane?.blocking),
        exonerated: toCount(lane?.exonerated),
        description: String(lane?.description || ''),
        findings: Array.isArray(lane?.findings) ? lane.findings.map(normalizeFinding).filter(Boolean) : [],
        findingsRecorded: lane?.findingsRecorded === true,
    };
}

/**
 * Each failed test once across the lanes it failed in, most severe label first, then most lanes.
 *
 * @param {Array} lanes - normalized lanes
 * @returns {Array<{title: string, file: string, label: string, blocking: boolean, lanes: number, explanation: string|null}>}
 */
function groupTests(lanes) {
    const byTest = new Map();
    for (const lane of lanes) {
        for (const f of lane.findings) {
            // Two suites of one file can share a leaf title: the full title tells their tests apart.
            const key = `${f.file}\n${f.fullTitle}`;
            const seen = byTest.get(key);
            if (!seen) {
                byTest.set(key, {title: f.title, fullTitle: f.fullTitle, file: f.file, label: f.label, blocking: f.blocking, lanes: 1, explanation: f.explanation});
                continue;
            }
            seen.lanes += 1;
            seen.blocking = seen.blocking || f.blocking;

            // The explanation stays with the label it was given for.
            if (labelRank(f.label) < labelRank(seen.label)) {
                seen.label = f.label;
                seen.explanation = f.explanation;
            } else if (!seen.explanation && f.label === seen.label) {
                seen.explanation = f.explanation;
            }
        }
    }
    return [...byTest.values()].sort((a, b) => labelRank(a.label) - labelRank(b.label) || b.lanes - a.lanes || a.title.localeCompare(b.title));
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

    const result = {...base, tests: [], laneCount: expectedLanes?.length || 0};
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

    // Only the matrix's own lanes name tests: a stray record is not this run's.
    const recorded = [];
    for (const expected of expectedLanes) {
        const leg = {platform: expected.platform || 'unknown', serverVersion: expected.server || ''};
        const record = byKey.get(laneKey(leg));

        // A lane triage could not settle is named as unknown; its tests are not counted as blocking or cleared.
        if (record && (record.verdict === 'SUCCESS' || record.verdict === 'FAILURE')) {
            recorded.push(record);
        }
        if (!record || !record.verdict) {
            result.unknownLegs.push({...leg, reason: 'not triaged'});
        } else if (record.verdict === 'SUCCESS') {
            result.clearedLegs.push({...leg, exonerated: record.exonerated});
            result.clearedCount += record.exonerated;
        } else if (record.verdict === 'FAILURE') {
            result.blockingLegs.push({...leg, blocking: record.blocking, testsNamed: record.findingsRecorded && record.findings.some((f) => f.blocking)});
            result.blockingCount += record.blocking;
        } else {
            result.unknownLegs.push({...leg, reason: 'triage needs investigation'});
        }
    }
    result.tests = groupTests(recorded);

    if (result.blockingLegs.length > 0) {
        const blocking = result.blockingCount > 0 ? `${result.blockingCount} blocking failure${result.blockingCount === 1 ? '' : 's'}` : 'Blocking failures';
        return {
            ...result,
            state: 'red',
            kind: 'blocking',
            commitStatusState: 'failure',
            statusDescription: `${blocking} after triage — needs investigation · ${countsLine}`,
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

    if (!upstreamJobsSucceeded) {
        return {
            ...result,
            state: 'yellow',
            kind: 'untriaged-upstream-failure',
            commitStatusState: 'error',
            statusDescription: 'CI job failed outside tracked tests; triage cannot clear it',
            note: 'A CI job failed outside tracked tests (install/build/teardown); triage cannot clear that.',
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

/**
 * Fold per-OS triage lanes into the post-merge (desktop-master) verdict.
 * Master lanes are per OS (one report per OS), so a lane's verdict covers
 * every leg of that OS. Policy legs are never judged by triage, and missing
 * legs cannot be vouched for — both stay unknown. An upstream CI failure
 * with no failing test cannot be cleared either.
 *
 * @param {Object} params
 * @param {Array<{platform: string, verdict?: string, blocking?: number|string, exonerated?: number|string}>} params.lanes - verdict records from the per-OS triage lanes
 * @param {Array<{os: string, kind?: string, status: string, failed: number}>} params.legs - per-leg summaries (buildLegSummaries rows)
 * @param {Array} [params.missingLegs] - legs with no/empty results
 * @param {boolean} [params.upstreamJobsSucceeded]
 * @param {boolean} [params.overallFailed]
 * @param {boolean} [params.noLegs] - true when the run reported no legs at all (never "cleared")
 * @returns {{verdict: 'cleared'|'blocking'|'inconclusive', clearedLegs: Array, blockingLegs: Array, unknownLegs: Array}}
 */
function foldMasterTriage({lanes = [], legs = [], missingLegs = [], upstreamJobsSucceeded = true, overallFailed = false, noLegs = false}) {
    const laneByOs = new Map();
    for (const lane of lanes || []) {
        const normalized = normalizeLane(lane);
        laneByOs.set(normalized.platform, normalized);
    }

    const clearedLegs = [];
    const blockingLegs = [];
    const unknownLegs = [];
    for (const leg of legs || []) {
        if (leg.status !== 'failed' || !(leg.failed > 0)) {
            continue;
        }
        let state = 'unknown';
        if (leg.kind !== 'policy') {
            const lane = laneByOs.get(leg.os);
            if (lane && lane.verdict === 'SUCCESS') {
                state = 'cleared';
            } else if (lane && lane.verdict === 'FAILURE') {
                state = 'blocking';
            }
        }
        if (state === 'cleared') {
            clearedLegs.push(leg);
        } else if (state === 'blocking') {
            blockingLegs.push(leg);
        } else {
            unknownLegs.push(leg);
        }
    }
    for (const leg of missingLegs || []) {
        unknownLegs.push(leg);
    }

    let verdict = 'cleared';
    if (blockingLegs.length > 0) {
        verdict = 'blocking';
    } else if (unknownLegs.length > 0 || noLegs || (overallFailed && !upstreamJobsSucceeded) || (overallFailed && clearedLegs.length === 0)) {
        // A failed run is cleared only on positive evidence: triage must
        // have cleared at least one failing leg.
        verdict = 'inconclusive';
    }
    return {verdict, clearedLegs, blockingLegs, unknownLegs};
}

function formatLeg(leg) {
    const emoji = PLATFORM_EMOJI[leg.platform] || PLATFORM_EMOJI.unknown;
    const name = PLATFORM_LABEL[leg.platform] || PLATFORM_LABEL.unknown;
    return `${emoji} ${name} Server \`${leg.serverVersion}\``;
}

// A test by its id when its title starts with one (MM-T4054), else its title, cut short.
// Two tests of one file with the same leaf title are named by their full titles.
function testName(t, shared) {
    if (shared.has(`${t.file}\n${t.title}`)) {
        return `\`${t.fullTitle.slice(0, 80)}\``;
    }
    const id = (/^(MM-T\d+(?:_\d+)?)\b/).exec(t.title)?.[1];
    return `\`${id || t.title.slice(0, 50)}\``;
}

function sharedTitles(tests) {
    const seen = new Set();
    const shared = new Set();
    for (const t of tests) {
        const key = `${t.file}\n${t.title}`;
        if (seen.has(key)) {
            shared.add(key);
        }
        seen.add(key);
    }
    return shared;
}

function formatTestLines(tests, laneCount, shared) {
    const spec = (file) => file.split('/').pop().replace(/\.(test|spec)\.[jt]s$/, '');
    const lines = tests.slice(0, 5).map((t) =>
        `• ${testName(t, shared)} ${spec(t.file)}: ${t.label}, failed in ${t.lanes}${laneCount ? `/${laneCount}` : ''} lane${(laneCount || t.lanes) === 1 ? '' : 's'}${t.explanation ? ` · ${t.explanation}` : ''}`);
    if (tests.length > 5) {
        lines.push(`…and ${tests.length - 5} more`);
    }
    return lines;
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

    const tests = fold.tests || [];
    const shared = sharedTitles(tests);
    const blockingTests = tests.filter((t) => t.blocking);
    const clearedTests = tests.filter((t) => !t.blocking);
    const titles = {
        passed: ':green_circle: **Desktop CMT — passed**',
        flaky: clearedTests.some((t) => t.label !== 'flaky') ? ':green_circle: **Desktop CMT — no app bug found**' : ':green_circle: **Desktop CMT — flaky, no bug found**',
        blocking: blockingTests.some((t) => t.label === 'app bug') ? ':red_circle: **Desktop CMT — app bug likely**' : ':red_circle: **Desktop CMT — needs investigation**',
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

    if (fold.kind === 'blocking' && blockingTests.length) {
        lines.push(...formatTestLines(blockingTests, fold.laneCount, shared));

        // A red lane whose findings were unread, or that is red only for a shard that never reported, names no test.
        const unnamed = fold.blockingLegs.filter((leg) => !leg.testsNamed);
        if (unnamed.length) {
            lines.push(`Also blocking, no test named: ${formatLegList(unnamed, (leg) => `${formatLeg(leg)}${leg.blocking > 0 ? ` — ${leg.blocking} blocking` : ''}`)}`);
        }
        if (clearedTests.length) {
            lines.push(`Not app bugs: ${formatLegList(clearedTests, (t) => `${testName(t, shared)} (${t.label})`)}`);
        }
    } else if (fold.kind === 'blocking') {
        const legs = formatLegList(fold.blockingLegs, (leg) =>
            `${formatLeg(leg)}${leg.blocking > 0 ? ` — ${leg.blocking} blocking` : ''}`);
        lines.push(`Blocking after triage: ${legs}`);
    } else if (fold.kind === 'flaky' && clearedTests.length) {
        lines.push(...formatTestLines(clearedTests, fold.laneCount, shared));
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

    // A red run can also have lanes triage could not settle: their tests are in none of the lines above.
    if (fold.kind === 'blocking' && fold.unknownLegs.length) {
        lines.push(`Could not settle: ${formatLegList(fold.unknownLegs, (leg) => `${formatLeg(leg)} (${leg.reason})`)}`);
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
    foldMasterTriage,
    formatCmtVerdictMessage,
    displayTotals,
};
