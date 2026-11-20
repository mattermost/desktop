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

/** A lane's identity: its platform and server version. */
function laneKey(lane) {
    return `${lane?.platform || ''}|${lane?.serverVersion || ''}`;
}

/** A non-negative integer count from a string or number; 0 for anything else. */
function toCount(value) {
    const n = Number.parseInt(value, 10);
    return Number.isInteger(n) && n > 0 ? n : 0;
}

/** A lane verdict as SUCCESS, FAILURE or ACTION_REQUIRED; '' for anything else. */
function normalizeVerdict(value) {
    const verdict = String(value || '').trim().toUpperCase();
    return ['SUCCESS', 'FAILURE', 'ACTION_REQUIRED'].includes(verdict) ? verdict : '';
}

// The toolkit's per-test labels, most severe first: a test failing in several lanes takes the most severe one.
// "needs investigation" and "out of date" are what triage wrote before "machine failure" and "fixed on main".
const LABEL_ORDER = ['app bug', 'caused by PR', 'broken on branch', 'machine failure', 'needs investigation', 'out of date', 'fixed on main', 'server compat', 'test bug', 'broken on main', 'flaky'];

/** A label's severity index in LABEL_ORDER; an unknown label ranks as a machine failure. */
function labelRank(label) {
    const i = LABEL_ORDER.indexOf(label);
    return i === -1 ? LABEL_ORDER.indexOf('machine failure') : i;
}

/** Windows reports name a spec with backslashes; one test is one test on every OS. */
const unixPath = (file) => file.replace(/\\/g, '/');

/** A per-test finding from triage with forward-slash paths; null when its title, file or label is missing. */
function normalizeFinding(row) {
    if (!row || typeof row.title !== 'string' || typeof row.file !== 'string' || typeof row.label !== 'string') {
        return null;
    }
    const [spec, ...rest] = (typeof row.full_title === 'string' && row.full_title ? row.full_title : row.title).split(' > ');
    return {
        title: row.title,
        fullTitle: [unixPath(spec), ...rest].join(' > '),
        file: unixPath(row.file),
        label: row.label,
        blocking: row.blocking === true,
        explanation: typeof row.explanation === 'string' && row.explanation ? row.explanation : null,
    };
}

// A lane whose results did not all arrive: it needs a re-run, whatever triage made of what did.
const INCOMPLETE = /results incomplete|report\(s\) missing|did not run/;

/** A triage lane with defaults filled in, counts parsed and findings normalized. */
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
 * @returns {Array<{title: string, file: string, label: string, blocking: boolean, lanes: number, servers: string[], explanation: string|null}>}
 */
function groupTests(lanes) {
    const byTest = new Map();
    for (const lane of lanes) {
        for (const f of lane.findings) {
            // Two suites of one file can share a leaf title: the full title tells their tests apart.
            const key = `${f.file}\n${f.fullTitle}`;
            const seen = byTest.get(key);
            if (!seen) {
                byTest.set(key, {title: f.title, fullTitle: f.fullTitle, file: f.file, label: f.label, blocking: f.blocking, lanes: 1, servers: [lane.serverVersion], explanation: f.explanation});
                continue;
            }
            seen.lanes += 1;
            if (!seen.servers.includes(lane.serverVersion)) {
                seen.servers.push(lane.serverVersion);
            }
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
                statusDescription: 'A CI job failed outside the tests; nothing was checked',
                note: 'A CI job failed outside the tests (install, build or cleanup), so no failure was checked.',
            };
        }
        if (failed > 0) {
            return {
                ...base,
                state: 'yellow',
                kind: 'untriaged-failures',
                commitStatusState: 'error',
                statusDescription: 'Tests failed but were not checked — look at the run',
                note: 'Tests failed, but the automatic check did not run, so none was checked.',
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

    const result = {...base, tests: [], laneCount: expectedLanes?.length || 0, servers: [...new Set((expectedLanes || []).map((l) => l.server || ''))]};
    if (!expectedLanes || expectedLanes.length === 0) {
        return {
            ...result,
            state: 'yellow',
            kind: 'no-triage-lanes',
            commitStatusState: 'error',
            statusDescription: 'No runs to check — look at the run',
            note: 'Tests failed, but the run had no OS and server combinations to check.',
        };
    }

    // Only the matrix's own lanes name tests: a stray record is not this run's.
    const recorded = [];
    for (const expected of expectedLanes) {
        const leg = {platform: expected.platform || 'unknown', serverVersion: expected.server || ''};
        const record = byKey.get(laneKey(leg));

        // A lane triage could not settle, or cleared on incomplete results, is named as unknown; its tests are not
        // counted as blocking or cleared.
        if (record && (record.verdict === 'FAILURE' || (record.verdict === 'SUCCESS' && !INCOMPLETE.test(record.description)))) {
            recorded.push(record);
        }
        if (!record || !record.verdict) {
            result.unknownLegs.push({...leg, reason: 'not triaged'});
        } else if (record.verdict === 'SUCCESS' && INCOMPLETE.test(record.description)) {
            // Cleared on part of its results is not cleared.
            result.unknownLegs.push({...leg, reason: 'results incomplete', incomplete: true});
        } else if (record.verdict === 'SUCCESS') {
            result.clearedLegs.push({...leg, exonerated: record.exonerated});
            result.clearedCount += record.exonerated;
        } else if (record.verdict === 'FAILURE') {
            result.blockingLegs.push({
                ...leg,
                blocking: record.blocking,
                testsNamed: record.findingsRecorded && record.findings.some((f) => f.blocking),
                incomplete: INCOMPLETE.test(record.description),
            });
            result.blockingCount += record.blocking;
        } else {
            result.unknownLegs.push({...leg, reason: 'triage gave no verdict', incomplete: INCOMPLETE.test(record.description)});
        }
    }
    result.tests = groupTests(recorded);
    const incompleteLegs = [...result.blockingLegs, ...result.unknownLegs].filter((leg) => leg.incomplete).length;

    if (result.blockingLegs.length > 0) {
        // Held tests are counted once across runs; a run that names none is counted as a run.
        const held = result.tests.filter((t) => t.blocking);
        const productBugs = held.filter((t) => PRODUCT.has(t.label)).length;

        // A run with failures it names no test for: whether or not its results all uploaded, those failures are real.
        const unnamed = result.blockingLegs.filter((leg) => !leg.testsNamed && (!leg.incomplete || leg.blocking > 0)).length;
        let summary = `${count(unnamed, 'run', 'runs')} failed, but which tests is not known — look at the run`;
        if (productBugs) {
            summary = `${count(productBugs, 'product bug', 'product bugs')} found`;
        } else if (held.length) {
            summary = `No product bugs found; ${count(held.length, 'failure', 'failures')} held`;
        } else if (!unnamed && incompleteLegs) {
            // Partial results can hide a failure: nothing is claimed until a re-run.
            summary = 'Test results did not fully upload, re-run';
        }
        const parts = [
            summary,
            held.length && unnamed ? `${count(unnamed, 'run', 'runs')} failed with no test named` : '',
            incompleteLegs && !summary.endsWith('re-run') ? 'some results did not upload' : '',
        ];
        return {
            ...result,
            state: 'red',
            kind: 'blocking',
            commitStatusState: 'failure',
            statusDescription: `${parts.filter(Boolean).join('; ')} · ${countsLine}`,
        };
    }

    if (result.unknownLegs.length > 0) {
        const n = result.unknownLegs.length;
        return {
            ...result,
            state: 'yellow',
            kind: 'inconclusive',
            commitStatusState: 'error',
            statusDescription: incompleteLegs === n ? `Test results did not fully upload for ${count(n, 'run', 'runs')}, re-run` : `Could not check ${count(n, 'run', 'runs')} — look at the run`,
        };
    }

    if (!upstreamJobsSucceeded) {
        return {
            ...result,
            state: 'yellow',
            kind: 'untriaged-upstream-failure',
            commitStatusState: 'error',
            statusDescription: 'A CI job failed outside the tests — look at the run',
            note: 'A CI job failed outside the tests (install, build or cleanup); that is not a test result, so look at the run.',
        };
    }

    const flaky = failed > 0 || result.clearedCount > 0;
    return {
        ...result,
        state: 'green',
        kind: flaky ? 'flaky' : 'passed',
        commitStatusState: 'success',
        statusDescription: flaky ? `No product bugs found · ${countsLine}` : countsLine,
    };
}

// The toolkit's status text for a lane red only for tests that passed on a retry (e2e-test-triage, triage.ts).
const FLAKY_ONLY = /^\(\d+ flaky, passed on retry\)/;

/**
 * Whether a triage lane cleared its OS status: SUCCESS, and it judged something there — test failures it cleared, or a
 * status red only for tests that passed on a retry (no failure to clear, so no findings). A status red outside the tests
 * (no test failed, a job died) gets SUCCESS with nothing judged: triage leaves that status as it is.
 */
function laneClearsStatus(lane) {
    return lane.verdict === 'SUCCESS' && (lane.exonerated > 0 || lane.findings.length > 0 || FLAKY_ONLY.test(lane.description));
}

/**
 * The status jobs that are red for a reason triage did not clear: an OS status whose triage lane did not clear it (see
 * laneClearsStatus), or the policy status (triage never judges policy legs). Keeping a status triage did not judge
 * here keeps the master alert from being suppressed.
 *
 * @param {Record<string, string>} statusResults - each status job's result ('success', 'failure', ...) by OS: linux, macos, windows, policy
 * @param {Array<{platform: string, verdict?: string, exonerated?: number|string, findings?: Array, description?: string}>} lanes - verdict records from the per-OS triage lanes
 * @returns {string[]} the uncleared status keys, in statusResults order
 */
function unclearedStatuses(statusResults = {}, lanes = []) {
    const cleared = new Set((lanes || []).map(normalizeLane).filter(laneClearsStatus).map((lane) => lane.platform));
    const red = Object.entries(statusResults || {}).filter(([os, result]) => result === 'failure' && (os === 'policy' || !cleared.has(os)));
    return red.map(([os]) => os);
}

/** Whether any status job is red and not cleared by triage; see unclearedStatuses. */
function redStatusNotCleared(statusResults = {}, lanes = []) {
    return unclearedStatuses(statusResults, lanes).length > 0;
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
 * @param {Record<string, string>} [params.statusResults] - per-OS and policy status job results
 * @returns {{verdict: 'cleared'|'blocking'|'inconclusive', clearedLegs: Array, blockingLegs: Array, unknownLegs: Array}}
 */
function foldMasterTriage({lanes = [], legs = [], missingLegs = [], upstreamJobsSucceeded = true, overallFailed = false, noLegs = false, statusResults = {}}) {
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

    // A leg whose report uploaded complete but with zero tests ran no tests:
    // its setup died before the first test. That is a setup problem, not a
    // failure for triage to settle and not a missing report.
    const setupLegs = [];
    for (const leg of missingLegs || []) {
        if (leg.status === 'no-results') {
            setupLegs.push(leg);
        } else {
            unknownLegs.push(leg);
        }
    }

    const redStatus = redStatusNotCleared(statusResults, lanes);
    let verdict = 'cleared';
    if (blockingLegs.length > 0) {
        verdict = 'blocking';
    } else if (unknownLegs.length > 0 || noLegs || redStatus || (overallFailed && !upstreamJobsSucceeded) || (overallFailed && clearedLegs.length === 0)) {
        // A failed run is cleared only on positive evidence: triage must
        // have cleared at least one failing leg, and no status job can still
        // be red for a reason triage did not clear.
        verdict = 'inconclusive';
    } else if (setupLegs.length > 0) {
        verdict = 'setup';
    }
    return {verdict, clearedLegs, blockingLegs, unknownLegs, setupLegs};
}

/** A leg as "<emoji> <OS>, server <version>". */
function formatLeg(leg) {
    const emoji = PLATFORM_EMOJI[leg.platform] || PLATFORM_EMOJI.unknown;
    const name = PLATFORM_LABEL[leg.platform] || PLATFORM_LABEL.unknown;
    return `${emoji} ${name}, server ${leg.serverVersion}`;
}

/** Text cut to max characters, ending in an ellipsis when cut. */
const cut = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/**
 * Each test by its id and title when its title starts with an id (MM-T4054 Open/Close…), else its title, cut
 * short; two tests of one file with the same leaf title by their full titles. A name that would read like another
 * test's is spelled out: the full title, then the file too.
 */
function testNames(tests) {
    const shared = sharedTitles(tests);
    const short = (t) => {
        if (shared.has(`${t.file}\n${t.title}`)) {
            return `\`${cut(t.fullTitle, 60)}\``;
        }
        const id = (/^(MM-T\d+(?:_\d+)?)\b/).exec(t.title)?.[1];
        return id ? `\`${id}\` ${cut(t.title.slice(id.length).trim(), 45)}` : `\`${cut(t.title, 45)}\``;
    };
    const apart = (names, longer) => names.map((n, i) => (names.filter((m) => m === n).length > 1 ? longer(tests[i]) : n));
    const names = apart(apart(tests.map(short), (t) => `\`${t.fullTitle}\``), (t) => `\`${t.file} > ${t.fullTitle}\``);
    return new Map(tests.map((t, i) => [t, names[i]]));
}

/** The file and title keys that more than one of the tests share. */
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

/** The first three, then how many more. */
function listOf(items, render) {
    const shown = items.slice(0, 3).map(render).join(' · ');
    return items.length > 3 ? `${shown} · and ${items.length - 3} more` : shown;
}

/** "n thing" or "n things". */
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Items joined as "a, b and c". */
const andList = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0] || '');

// Triage's labels, by what they mean for the release: a product bug, a problem with the test, a failure by chance,
// or one master has too.
const PRODUCT = new Set(['app bug', 'caused by PR']);
const TEST_PROBLEM = new Set(['test bug', 'server compat', 'out of date', 'fixed on main']);

/** Why a test failed, in plain words. */
function reasonFor(t) {
    // Master verdicts carry no server version, so the reason names none.
    const servers = t.servers.length ? `server ${andList(t.servers)}` : 'this server version';
    const reasons = {
        'app bug': 'the app does not do what the test expects',
        'caused by PR': 'caused by this change',
        'test bug': 'the test itself is wrong, not the app',
        'server compat': `the test does not handle ${servers}`,
        'out of date': 'master changed this test after this release was cut',
        'fixed on main': 'master has since fixed this test',
        flaky: 'failed by chance or because of the test machine; it passes on retry or on other runs',
        'broken on main': 'it fails on master too',
    };
    return reasons[t.label] || 'the cause is not clear';
}

/**
 * Each failed test of a master run once, with the operating systems it failed on: still blocking first, then the most
 * severe label.
 *
 * @param {Array} lanes - per-OS verdict records
 * @returns {Array<{title: string, fullTitle: string, file: string, label: string, blocking: boolean, platforms: string[], servers: string[]}>}
 */
function groupMasterTests(lanes) {
    const byTest = new Map();
    for (const lane of (lanes || []).map(normalizeLane)) {
        for (const f of lane.findings) {
            const key = `${f.file}\n${f.fullTitle}`;
            const seen = byTest.get(key);
            if (!seen) {
                byTest.set(key, {...f, platforms: [lane.platform], servers: []});
                continue;
            }
            if (!seen.platforms.includes(lane.platform)) {
                seen.platforms.push(lane.platform);
            }
            seen.blocking = seen.blocking || f.blocking;
            if (labelRank(f.label) < labelRank(seen.label)) {
                seen.label = f.label;
            }
        }
    }
    return [...byTest.values()].sort((a, b) => Number(b.blocking) - Number(a.blocking) || labelRank(a.label) - labelRank(b.label) || a.title.localeCompare(b.title));
}

/**
 * The master alert's lines naming each failed test: what still needs a look, why and on which OS, then what triage
 * cleared. Empty when the lanes recorded no tests.
 *
 * @param {Array} lanes - per-OS verdict records
 * @returns {string[]}
 */
function formatMasterTestLines(lanes) {
    const tests = groupMasterTests(lanes);
    if (!tests.length) {
        return [];
    }
    const names = testNames(tests);
    const where = (t) => t.platforms.map((p) => `${PLATFORM_EMOJI[p] || PLATFORM_EMOJI.unknown} ${PLATFORM_LABEL[p] || PLATFORM_LABEL.unknown}`).join(', ');
    const lines = [];

    // Each section: its first three tests with why and on which OS, then how many more.
    const section = (title, list) => {
        if (list.length) {
            lines.push(`${title} (${list.length})`, ...list.slice(0, 3).map((t) => `• ${names.get(t)} — ${reasonFor(t)} · ${where(t)}`));
            if (list.length > 3) {
                lines.push(`…and ${list.length - 3} more in the run`);
            }
        }
    };
    section('🔎 **Held**', tests.filter((t) => t.blocking));
    section('🔁 **Not product bugs**', tests.filter((t) => !t.blocking));
    return lines;
}

/**
 * The channel message: for each failure, whether it is a product bug, a problem with the test, flaky, or a
 * problem with the test setup, in plain words. The details are in the run.
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
    const name = `**Desktop CMT${branch ? ` ${branch}` : ''}**`;
    const runs = fold.laneCount || 0;
    const allServers = fold.servers || [];

    const tests = fold.tests || [];
    const names = testNames(tests);
    const where = (t) => {
        const onSome = t.servers.length < allServers.length && t.label !== 'server compat' ? `, on server ${andList(t.servers)}` : '';
        return `${t.lanes} of ${runs || t.lanes} runs${onSome}`;
    };
    const line = (t, reason = reasonFor(t)) => `• ${names.get(t)} — ${reason} · ${where(t)}`;
    const productBugs = tests.filter((t) => t.blocking && PRODUCT.has(t.label));
    const needsLook = tests.filter((t) => t.blocking && !PRODUCT.has(t.label));
    const testProblems = tests.filter((t) => !t.blocking && TEST_PROBLEM.has(t.label));
    const flaky = tests.filter((t) => !t.blocking && t.label === 'flaky');
    const onMaster = tests.filter((t) => !t.blocking && t.label === 'broken on main');

    // A run with incomplete results needs a re-run, whether it names a test or could not be checked.
    const redLegs = fold.kind === 'blocking' ? fold.blockingLegs : [];
    const incomplete = [...redLegs, ...fold.unknownLegs].filter((leg) => leg.incomplete);
    const redUnnamed = redLegs.filter((leg) => !leg.testsNamed && (!leg.incomplete || leg.blocking > 0));
    const unsettled = fold.unknownLegs.filter((leg) => !leg.incomplete);

    const unchecked = {
        'untriaged-upstream-failure': 'a CI job failed outside the tests',
        'untriaged-failures': 'tests failed but were not checked',
        'no-triage-lanes': 'tests failed but there was nothing to check',
    };
    let headline = `:yellow_circle: ${name}: ${unchecked[fold.kind] || 'not every run could be checked'}`;
    if (fold.kind === 'blocking') {
        let red = `${count(redUnnamed.length, 'run', 'runs')} failed, but which tests is not known`;
        if (productBugs.length) {
            red = `${count(productBugs.length, 'product bug', 'product bugs')} found`;
        } else if (needsLook.length) {
            red = `no product bugs found · ${count(needsLook.length, 'failure', 'failures')} held`;
        } else if (incomplete.length && !redUnnamed.length) {
            red = 'test results did not fully upload, re-run to see if anything failed';
        }
        headline = `:red_circle: ${name}: ${red}`;
    } else if (fold.kind === 'flaky') {
        headline = `:green_circle: ${name}: no product bugs found`;
    } else if (fold.kind === 'passed') {
        headline = `:green_circle: ${name}: all tests passed`;
    }

    const lines = [headline];
    const section = (title, list, render = line) => {
        if (list.length) {
            lines.push(`${title} (${list.length})`, ...list.slice(0, 3).map((t) => render(t)));
            if (list.length > 3) {
                lines.push(`…and ${list.length - 3} more in the run`);
            }
        }
    };
    section('🐞 **Product bugs**', productBugs);
    section('🔎 **Held**', needsLook, (t) => line(t, t.label === 'needs investigation' || t.label === 'machine failure' || PRODUCT.has(t.label) ? reasonFor(t) : `${reasonFor(t)}, but that may not be the cause`));
    section('🧪 **Problems with the test, not product bugs**', testProblems);
    if (flaky.length) {
        lines.push(`🔁 **Flaky, not product bugs** (${flaky.length}): ${listOf(flaky, (t) => names.get(t))} — ${reasonFor(flaky[0])}`);
    }
    if (onMaster.length) {
        lines.push(`↩️ **Also failing on master** (${onMaster.length}): ${listOf(onMaster, (t) => names.get(t))}`);
    }
    if (fold.kind === 'flaky' && !tests.length && fold.clearedCount > 0) {
        lines.push(`🔁 **Not product bugs:** ${count(fold.clearedCount, 'failure was', 'failures were')} checked and cleared`);
    }
    if (incomplete.length) {
        const share = incomplete.length === runs ? `all ${runs}` : `${incomplete.length} of ${runs}`;
        lines.push(`⚙️ **Setup problem:** test results did not fully upload for ${share} runs — re-run to confirm`);
    }
    if (redUnnamed.length) {
        lines.push(`⚙️ **Failed, test not known:** ${listOf(redUnnamed, formatLeg)} — look at the run`);
    }
    if (unsettled.length) {
        lines.push(`⚙️ **Could not check:** ${listOf(unsettled, formatLeg)} — look at the run`);
    } else if (!fold.unknownLegs.length && fold.state === 'yellow' && fold.note) {
        lines.push(`⚙️ ${fold.note}`);
    }

    const links = [
        reportUrl ? `[Report](${reportUrl})` : '',
        runUrl ? `[Run](${runUrl})` : '',
    ].filter(Boolean);
    lines.push([`${passed} passed`, `${failed} failed`, `${skipped} skipped`, ...links].join(' · '));

    return lines.join('\n') + '\n';
}

module.exports = {
    laneKey,
    normalizeVerdict,
    foldCmtVerdicts,
    foldMasterTriage,
    redStatusNotCleared,
    formatMasterTestLines,
    formatCmtVerdictMessage,
    displayTotals,
    unclearedStatuses,
};
