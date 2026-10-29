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

// Windows reports name a spec with backslashes; one test is one test on every OS.
const unixPath = (file) => file.replace(/\\/g, '/');

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
            result.unknownLegs.push({...leg, reason: 'triage needs investigation', incomplete: INCOMPLETE.test(record.description)});
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
            summary = `No product bugs found; ${count(held.length, 'failure needs', 'failures need')} a look`;
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
    return `${emoji} ${name}, server ${leg.serverVersion}`;
}

const cut = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

// Each test by its id and title when its title starts with an id (MM-T4054 Open/Close…), else its title, cut
// short; two tests of one file with the same leaf title by their full titles. A name that would read like another
// test's is spelled out: the full title, then the file too.
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

// The first three, then how many more.
function listOf(items, render) {
    const shown = items.slice(0, 3).map(render).join(' · ');
    return items.length > 3 ? `${shown} · and ${items.length - 3} more` : shown;
}

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const andList = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0] || '');

// Triage's labels, by what they mean for the release: a product bug, a problem with the test, a failure by chance,
// or one master has too.
const PRODUCT = new Set(['app bug', 'caused by PR']);
const TEST_PROBLEM = new Set(['test bug', 'server compat', 'out of date', 'fixed on main']);

// Why a test failed, in plain words.
function reasonFor(t) {
    const servers = `server ${andList(t.servers)}`;
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
            red = `no product bugs found · ${count(needsLook.length, 'failure needs', 'failures need')} a look`;
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
    section('🔎 **Needs a look**', needsLook, (t) => line(t, t.label === 'needs investigation' || PRODUCT.has(t.label) ? reasonFor(t) : `${reasonFor(t)}, but that may not be the cause`));
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
    formatCmtVerdictMessage,
    displayTotals,
};
