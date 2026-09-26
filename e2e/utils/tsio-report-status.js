// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable no-console -- Logging is intentional in CI utility scripts */

const PRODUCTION_URL = 'https://test-io.test.mattermost.com';
const STAGING_URL = 'https://staging-test-io.test.mattermost.com';

const TERMINAL_STATUSES = ['completed', 'incomplete'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function intEnv(name, fallback) {
    const raw = process.env[name];
    if (raw === undefined || raw === '') {
        return fallback;
    }
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : fallback;
}

function positiveInt(value, fallback) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : fallback;
}

const {
    parseCmtJobName,
    fetchPerJobCountsFromConsolidated,
    buildIndividualReportUrl,
} = require('./cmt-channel-notify');
const {
    osStatusContext,
    policyStatusContext,
    E2E_OS_LIST,
    E2E_POLICY_OS_LIST,
} = require('./github-actions');

/**
 * Bucket key for commit-status aggregation.
 * Policy legs use `<os>-policy` so they do not fold into e2e/<os>.
 *
 * @param {{os: string, kind?: string}|null} parsed
 * @returns {string|null}
 */
function statusBucketKey(parsed) {
    if (!parsed || parsed.os === 'unknown') {
        return null;
    }
    if (parsed.kind === 'policy') {
        return `${parsed.os}-policy`;
    }
    return parsed.os;
}

/**
 * Uploaded TSIO reports in one status bucket (linux|macos|windows|<os>-policy).
 *
 * @param {Object} [detail]
 * @param {string} bucketKey
 * @returns {number}
 */
function countReportsForBucket(detail, bucketKey) {
    if (!bucketKey) {
        return 0;
    }
    return (detail?.reports || []).filter((report) => {
        const name = report.gh_job_name || report.display_name;
        return statusBucketKey(parseCmtJobName(name)) === bucketKey;
    }).length;
}

/**
 * `row.hasResults` is true if *any* shard in the bucket has counts, so a sibling
 * upload can still be missing from `perJobCounts`.
 *
 * @returns {boolean|undefined} undefined when the bucket has no uploaded reports
 */
function hasCountsForEveryUploadedReport(detail, perJobCounts, bucketKey) {
    const names = (detail?.reports || []).map((report) => report.gh_job_name || report.display_name);
    const jobNames = [...new Set(names.filter(
        (name) => Boolean(name) && statusBucketKey(parseCmtJobName(name)) === bucketKey,
    ))];
    if (jobNames.length === 0) {
        return undefined;
    }
    if (!perJobCounts) {
        return false;
    }
    return jobNames.every((name) => Object.prototype.hasOwnProperty.call(perJobCounts, name));
}

/**
 * Whether the poll loop can stop. Per-OS status jobs stop once that OS's
 * shards are uploaded, not when every report in the group has landed.
 *
 * @returns {boolean}
 */
function shardsAreReady({detail, totalReportsExpected, readyWhenOs, readyWhenPolicy, minReports}) {
    const reports = Array.isArray(detail?.reports) ? detail.reports : [];
    const needed = positiveInt(minReports, 1);

    if (readyWhenPolicy) {
        const n = reports.filter((report) => {
            const parsed = parseCmtJobName(report.gh_job_name || report.display_name);
            return parsed?.kind === 'policy';
        }).length;
        return n >= needed;
    }

    if (readyWhenOs) {
        return countReportsForBucket(detail, readyWhenOs) >= needed;
    }

    return totalReportsExpected <= 0 || reports.length >= totalReportsExpected;
}

const EMPTY_OS_ROW = {passed: 0, failed: 0, skipped: 0, shardFailed: false, hasResults: false};

/**
 * Playwright can fail while the CI job still exits 0 (TSIO is the failure
 * signal). Without per-job counts we cannot tell which OS failed, so do not
 * post success.
 *
 * @returns {boolean}
 */
function countsUnavailableWithFailures(row, completeness) {
    const overallFailed = Number(completeness.overallFailed) || 0;
    if (overallFailed <= 0) {
        return false;
    }
    if (row.failed > 0 || row.shardFailed) {
        return false;
    }
    if (completeness.hasPerJobCounts === false) {
        return true;
    }
    if (completeness.hasCountsForEveryUploadedReport === false) {
        return true;
    }
    return !row.hasResults;
}

/**
 * Fail the status job from this OS/policy scope only — never from global
 * `stats.failed` (other OS reports may already be in the same TSIO group).
 *
 * @returns {boolean}
 */
function shouldFailFromScope({
    failOnTestFailures,
    readyWhenOs,
    readyWhenPolicy,
    overallState,
    byKey,
    upstreamJobsSucceeded,
    minReports,
    detail,
    perJobCounts,
    hasPerJobCounts,
    overallFailed,
}) {
    if (!failOnTestFailures) {
        return false;
    }

    const counts = {detail, perJobCounts, hasPerJobCounts, overallFailed};

    if (readyWhenOs) {
        return statusFromTotals(
            byKey[readyWhenOs] || EMPTY_OS_ROW,
            upstreamJobsSucceeded,
            'E2E incomplete — no results for this OS',
            bucketCompleteness(readyWhenOs, minReports, counts),
        ).state !== 'success';
    }

    if (readyWhenPolicy) {
        return E2E_POLICY_OS_LIST.some((os) => statusFromTotals(
            byKey[`${os}-policy`] || EMPTY_OS_ROW,
            upstreamJobsSucceeded,
            'Policy incomplete — no results for this OS',
            bucketCompleteness(`${os}-policy`, 1, counts),
        ).state !== 'success');
    }

    return overallState === 'failure';
}

/**
 * Whether any *in-scope* bucket has a failed shard, so a macos failure cannot
 * make the linux status job post e2e/linux as error.
 *
 * @returns {boolean}
 */
function scopedHasShardFailure(byKey, expectedOs, expectedPolicyOs) {
    const oss = resolveExpectedOs(expectedOs, byKey);
    const policyOss = resolveExpectedPolicyOs(expectedPolicyOs);
    const keys = [...oss, ...policyOss.map((os) => `${os}-policy`)];
    return keys.some((key) => byKey[key]?.shardFailed);
}

/**
 * Aggregate TSIO per-job counts / shard failures by status bucket
 * (linux|macos|windows|macos-policy|windows-policy).
 *
 * @param {Object} params
 * @param {Object} params.detail - TSIO group detail
 * @param {Record<string, {passed?: number, failed?: number, skipped?: number, flaky?: number}>} params.perJobCounts
 * @returns {Record<string, {passed: number, failed: number, skipped: number, shardFailed: boolean, hasResults: boolean}>}
 */
function buildOsStatusTotals({detail, perJobCounts}) {
    /** @type {Record<string, {passed: number, failed: number, skipped: number, shardFailed: boolean, hasResults: boolean}>} */
    const byKey = {};

    const ensure = (key) => {
        if (!byKey[key]) {
            byKey[key] = {passed: 0, failed: 0, skipped: 0, shardFailed: false, hasResults: false};
        }
        return byKey[key];
    };

    for (const [jobName, counts] of Object.entries(perJobCounts || {})) {
        const key = statusBucketKey(parseCmtJobName(jobName));
        if (!key) {
            continue;
        }
        const row = ensure(key);
        row.passed += (counts.passed || 0) + (counts.flaky || 0);
        row.failed += counts.failed || 0;
        row.skipped += counts.skipped || 0;
        row.hasResults = true;
    }

    for (const report of detail?.reports || []) {
        const name = report.gh_job_name || report.display_name;
        const key = statusBucketKey(parseCmtJobName(name));
        if (!key) {
            continue;
        }
        const row = ensure(key);
        if (report.status === 'failed') {
            row.shardFailed = true;
        }
    }

    return byKey;
}

/**
 * Commit-status click-through for one e2e/<os> (or e2e/<os>-policy) bucket.
 * PR/master has one uploaded report per bucket → /reports/r/{id}.
 * CMT may have several versions on the same OS: link a failed leg if any,
 * otherwise keep the group rollup so the check is not one arbitrary version.
 *
 * @param {Object} params
 * @param {Array<{id?: string, gh_job_name?: string, display_name?: string, status?: string}>} [params.reports]
 * @param {string} params.bucketKey
 * @param {string} [params.baseUrl]
 * @param {string} params.fallbackUrl
 * @returns {string}
 */
function reportUrlForStatusBucket({reports, bucketKey, baseUrl, fallbackUrl}) {
    if (!baseUrl || !bucketKey) {
        return fallbackUrl;
    }

    const matching = (reports || []).filter((report) => {
        if (!report?.id) {
            return false;
        }
        const name = report.gh_job_name || report.display_name;
        return statusBucketKey(parseCmtJobName(name)) === bucketKey;
    });

    if (matching.length === 1) {
        return buildIndividualReportUrl(baseUrl, matching[0].id);
    }

    if (matching.length > 1) {
        const failed = matching.find((report) => report.status === 'failed');
        if (failed) {
            return buildIndividualReportUrl(baseUrl, failed.id);
        }
    }

    return fallbackUrl;
}

/**
 * Resolve which OS contexts this run should report.
 * `null` means flip none (policy-only status job). Empty/omitted still falls
 * back to whatever OS buckets have results, or all three.
 *
 * @param {string[]|null} [expectedOs]
 * @param {Record<string, unknown>} byKey
 * @returns {string[]}
 */
function resolveExpectedOs(expectedOs, byKey) {
    if (expectedOs === null) {
        return [];
    }
    if (Array.isArray(expectedOs) && expectedOs.length > 0) {
        return expectedOs.filter((os) => E2E_OS_LIST.includes(os));
    }
    const fromResults = Object.keys(byKey || {}).filter((os) => E2E_OS_LIST.includes(os));
    return fromResults.length > 0 ? fromResults : [...E2E_OS_LIST];
}

/**
 * Resolve which policy OS contexts this run should report.
 * Only flips when explicitly expected (PR/master) — CMT has no policy legs.
 *
 * @param {string[]} [expectedPolicyOs]
 * @returns {string[]}
 */
function resolveExpectedPolicyOs(expectedPolicyOs) {
    if (!Array.isArray(expectedPolicyOs) || expectedPolicyOs.length === 0) {
        return [];
    }
    return expectedPolicyOs.filter((os) => E2E_POLICY_OS_LIST.includes(os));
}

/**
 * @param {Object} row
 * @param {boolean} upstreamJobsSucceeded
 * @param {string} incompleteLabel
 * @param {{minReports?: number, uploadedReports?: number, hasPerJobCounts?: boolean, hasCountsForEveryUploadedReport?: boolean, overallFailed?: number}} [completeness]
 * @returns {{state: string, description: string}}
 */
function statusFromTotals(row, upstreamJobsSucceeded, incompleteLabel, completeness = {}) {
    const hasFailures = row.failed > 0 || row.shardFailed;
    if (hasFailures) {
        return {
            state: 'failure',
            description: `${row.passed} passed, ${row.failed} failed, ${row.skipped} skipped`,
        };
    }

    const {minReports} = completeness;
    const requiresShards = Number.isInteger(minReports) && minReports > 0;
    let uploaded = 0;
    if (requiresShards) {
        if (Number.isInteger(completeness.uploadedReports)) {
            uploaded = completeness.uploadedReports;
        } else if (row.hasResults) {
            uploaded = 1;
        }
        if (uploaded < minReports) {
            return {
                state: upstreamJobsSucceeded ? 'error' : 'failure',
                description: `E2E incomplete — ${uploaded}/${minReports} shards`,
            };
        }
        if (!upstreamJobsSucceeded) {
            return {
                state: 'failure',
                description: 'CI job failed (untracked by TSIO)',
            };
        }
    }

    if (countsUnavailableWithFailures(row, completeness)) {
        return {
            state: 'error',
            description: 'TSIO per-job counts unavailable with test failures',
        };
    }
    if (completeness.hasCountsForEveryUploadedReport === false) {
        return {
            state: 'error',
            description: 'TSIO per-job counts incomplete for this OS',
        };
    }
    if (row.hasResults) {
        return {
            state: 'success',
            description: `${row.passed} passed, ${row.failed} failed, ${row.skipped} skipped`,
        };
    }
    if (requiresShards) {
        return {
            state: 'success',
            description: `${uploaded}/${minReports} shards uploaded`,
        };
    }
    if (upstreamJobsSucceeded) {
        return {
            state: 'error',
            description: incompleteLabel,
        };
    }
    return {
        state: 'failure',
        description: 'CI job failed (untracked by TSIO)',
    };
}

/**
 * `statusFromTotals` completeness for one bucket. `minReports` is only set for
 * the bucket this job waited on; otherwise shard counts are not enforced.
 */
function bucketCompleteness(bucketKey, minReports, {detail, perJobCounts, hasPerJobCounts, overallFailed}) {
    return {
        minReports,
        uploadedReports: countReportsForBucket(detail, bucketKey),
        hasPerJobCounts,
        overallFailed,
        hasCountsForEveryUploadedReport: hasCountsForEveryUploadedReport(detail, perJobCounts, bucketKey),
    };
}

/**
 * @param {Object} params
 * @param {string} params.targetUrl - Group / fallback TSIO URL
 * @param {string} [params.baseUrl] - TSIO origin used to build per-leg /reports/r/{id} links
 * @param {string[]} [params.expectedOs]
 * @param {string[]} [params.expectedPolicyOs]
 * @returns {Promise<void>}
 */
async function flipPerOsCommitStatuses({
    github,
    context,
    compositeIdentity,
    detail,
    perJobCounts,
    targetUrl,
    baseUrl,
    upstreamJobsSucceeded,
    expectedOs,
    expectedPolicyOs,
    readyWhenOs,
    readyWhenPolicy = false,
    minReports,
    hasPerJobCounts,
    overallFailed,
    core,
}) {
    const byKey = buildOsStatusTotals({detail, perJobCounts});
    const oss = resolveExpectedOs(expectedOs, byKey);
    const policyOss = resolveExpectedPolicyOs(expectedPolicyOs);
    const emptyRow = {passed: 0, failed: 0, skipped: 0, shardFailed: false, hasResults: false};
    const reports = detail?.reports || [];
    const counts = {detail, perJobCounts, hasPerJobCounts, overallFailed};

    const urlFor = (bucketKey) => reportUrlForStatusBucket({
        reports,
        bucketKey,
        baseUrl,
        fallbackUrl: targetUrl,
    });

    const posts = [
        ...oss.map(async (os) => {
            const row = byKey[os] || emptyRow;
            const {state, description} = statusFromTotals(
                row,
                upstreamJobsSucceeded,
                'E2E incomplete — no results for this OS',
                bucketCompleteness(os, readyWhenOs === os ? minReports : undefined, counts),
            );
            try {
                await github.rest.repos.createCommitStatus({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    sha: compositeIdentity.commit_sha,
                    state,
                    context: osStatusContext(os),
                    description: description.slice(0, 140),
                    target_url: urlFor(os),
                });
            } catch (error) {
                core.warning(`Failed to create ${osStatusContext(os)} status: ${error.message}`);
            }
        }),
        ...policyOss.map(async (os) => {
            const row = byKey[`${os}-policy`] || emptyRow;
            const {state, description} = statusFromTotals(
                row,
                upstreamJobsSucceeded,
                'Policy incomplete — no results for this OS',
                bucketCompleteness(`${os}-policy`, readyWhenPolicy ? 1 : undefined, counts),
            );
            try {
                await github.rest.repos.createCommitStatus({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    sha: compositeIdentity.commit_sha,
                    state,
                    context: policyStatusContext(os),
                    description: description.slice(0, 140),
                    target_url: urlFor(`${os}-policy`),
                });
            } catch (error) {
                core.warning(`Failed to create ${policyStatusContext(os)} status: ${error.message}`);
            }
        }),
    ];

    await Promise.all(posts);
}

/**
 * Commit-level rollup URL: /reports/{repo}/{branch}/{shortSha}/{name}
 * e.g. https://test-io.test.mattermost.com/reports/desktop/tsio-spike/cff190a/desktop-pr
 */
function buildDisplayReportUrl(baseUrl, compositeIdentity) {
    const repoTrailing = (compositeIdentity.repository || '').split('/').pop() || compositeIdentity.repository;
    const repo = encodeURIComponent(repoTrailing);
    const branch = encodeURIComponent(
        (compositeIdentity.branch || 'main').replace(/^refs\/heads\//, '').replace(/^refs\/tags\//, ''),
    );
    const shortSha = (compositeIdentity.commit_sha || '').slice(0, 7);
    const name = encodeURIComponent(compositeIdentity.name);
    return `${baseUrl}/reports/${repo}/${branch}/${shortSha}/${name}`;
}

/**
 * CMT must never write the e2e/<os> or policy contexts — those are PR/master
 * required checks. CMT posts only its `commitStatusContext`.
 */
function shouldPostPerOsCommitStatuses(perOsCommitStatuses, compositeIdentity) {
    return Boolean(perOsCommitStatuses) && compositeIdentity?.name !== 'cmt-desktop';
}

/**
 * Recover a report group's id via the idempotent begin endpoint, poll the
 * public status endpoint until the group leaves in_progress, render a step
 * summary, and flip commit status(es).
 * @param {Object} params - Parameters object
 * @param {Object} params.core - @actions/core from actions/github-script
 * @param {Object} params.context - GitHub Actions context
 * @param {Object} params.github - GitHub API client from actions/github-script
 * @param {Object} params.compositeIdentity - {repository, commit_sha, gh_run_id, name, gh_run_attempt, branch, gh_pr_number}
 * @param {number} params.totalReportsExpected - Number of per-leg reports expected in this group
 * @param {string} [params.commitStatusContext] - Optional umbrella context (e.g. CMT)
 * @param {boolean} [params.perOsCommitStatuses] - When true, also flip e2e/linux|macos|windows
 * @param {string[]} [params.expectedOs] - Canonical OS list for this run (linux|macos|windows)
 * @param {string[]} [params.expectedPolicyOs] - Policy OS list (macos|windows); PR/master only
 * @param {boolean} [params.failOnTestFailures] - When true (default), throw if tests/shards/upstream CI failed (not merely TSIO still consolidating)
 * @param {boolean} [params.notifyChannel] - When false, skip Mattermost webhook (per-OS status jobs). Default true.
 * @param {string} [params.readyWhenOs] - Poll until this OS's e2e shards are uploaded (linux|macos|windows)
 * @param {boolean} [params.readyWhenPolicy] - Poll until policy reports are uploaded
 * @param {number} [params.minReports] - Reports required for readyWhenOs / readyWhenPolicy
 * @param {boolean} [params.useStaging] - Target TSIO staging instead of production
 * @param {string} [params.oidcAudience] - OIDC audience claim TSIO expects
 * @param {boolean} [params.upstreamJobsSucceeded] - When false (default true), force the
 *   commit status to failure regardless of TSIO's test stats. TSIO only sees test-case-level
 *   results, so a job-level failure with no failing test attached to it (e.g. a hung worker
 *   teardown, a crashed runner, npm ci failing before any test ran) would otherwise still
 *   read as "100% passed" here even though the actual CI run failed.
 * @param {number} [params.pollAttempts] - How many times to poll report group status (default
 *   12, or TSIO_POLL_ATTEMPTS env). CMT runs with many legs should pass a higher value.
 * @param {number} [params.pollDelayMs] - Delay between polls in ms (default 5000, or
 *   TSIO_POLL_DELAY_MS env).
 * @returns {Promise<{reportUrl: string, status: string, stats: Object}>}
 */
async function reportTsioStatus({
    core,
    context,
    github,
    compositeIdentity,
    totalReportsExpected,
    commitStatusContext,
    perOsCommitStatuses = false,
    expectedOs,
    expectedPolicyOs,
    failOnTestFailures = true,
    notifyChannel = true,
    readyWhenOs,
    readyWhenPolicy = false,
    minReports,
    useStaging = false,
    oidcAudience = 'mattermost-test-system-io',
    upstreamJobsSucceeded = true,
    pollAttempts,
    pollDelayMs,
}) {
    const postPerOsCommitStatuses = shouldPostPerOsCommitStatuses(perOsCommitStatuses, compositeIdentity);
    const resolvedPollAttempts = positiveInt(
        pollAttempts ?? intEnv('TSIO_POLL_ATTEMPTS', 12),
        12,
    );
    const resolvedPollDelayMs = positiveInt(
        pollDelayMs ?? intEnv('TSIO_POLL_DELAY_MS', 5000),
        5000,
    );

    const baseUrl = useStaging ? STAGING_URL : PRODUCTION_URL;

    // Fallback target for the commit status when no TSIO report ever gets
    // created (begin/poll failed outright) — the reviewer still needs
    // somewhere to click instead of a stuck `pending` row.
    const runUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

    let reportId;
    let displayReportUrl;
    let groupReportUrl;
    let detail;
    try {
        const idToken = await core.getIDToken(oidcAudience);
        core.setSecret(idToken);

        const beginRes = await fetch(`${baseUrl}/api/v1/reports/begin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
                repository: compositeIdentity.repository,
                commit: compositeIdentity.commit_sha,
                gh_run_id: compositeIdentity.gh_run_id,
                gh_run_attempt: compositeIdentity.gh_run_attempt,
                framework: 'playwright',
                name: compositeIdentity.name,
                branch: compositeIdentity.branch,
                total_reports_expected: totalReportsExpected,
                ...(compositeIdentity.gh_pr_number ? {gh_pr_number: parseInt(compositeIdentity.gh_pr_number, 10)} : {}),
            }),
        });
        if (!beginRes.ok) {
            throw new Error(`reports/begin failed: ${beginRes.status} ${await beginRes.text()}`);
        }
        ({report_id: reportId} = await beginRes.json());

        displayReportUrl = buildDisplayReportUrl(baseUrl, compositeIdentity);
        groupReportUrl = `${baseUrl}/reports/g/${reportId}`;

        let shardsReadySinceAttempt = -1;
        for (let attempt = 0; attempt < resolvedPollAttempts; attempt++) {
            const statusRes = await fetch(`${baseUrl}/api/v1/reports/${reportId}`);
            if (!statusRes.ok) {
                throw new Error(`reports/${reportId} failed: ${statusRes.status} ${await statusRes.text()}`);
            }
            detail = await statusRes.json();
            const shardsReady = shardsAreReady({
                detail,
                totalReportsExpected,
                readyWhenOs,
                readyWhenPolicy,
                minReports,
            });

            if (shardsReady && shardsReadySinceAttempt < 0) {
                shardsReadySinceAttempt = attempt;
            }

            // Prefer `completed`. Otherwise stop once every expected shard is present —
            // TSIO can stay `in_progress` indefinitely after 5/5 uploads (consolidation lag).
            // Give a short grace window after shardsReady so status can flip to completed.
            if (detail.status === 'completed') {
                break;
            }
            if (TERMINAL_STATUSES.includes(detail.status) && shardsReady) {
                break;
            }
            const gracePolls = 3;
            if (
                shardsReady &&
                shardsReadySinceAttempt >= 0 &&
                attempt - shardsReadySinceAttempt >= gracePolls
            ) {
                break;
            }
            if (attempt < resolvedPollAttempts - 1) {
                await sleep(resolvedPollDelayMs);
            }
        }
    } catch (error) {
        core.error(`TSIO reporting error: ${error.message}`);
        const errTarget = groupReportUrl || displayReportUrl || runUrl;
        if (commitStatusContext) {
            try {
                await github.rest.repos.createCommitStatus({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    sha: compositeIdentity.commit_sha,
                    state: 'failure',
                    context: commitStatusContext,
                    description: 'TSIO reporting error — see workflow run for details',
                    target_url: errTarget,
                });
            } catch (statusError) {
                core.warning(`Failed to create failure commit status: ${statusError.message}`);
            }
        }
        if (postPerOsCommitStatuses) {
            const oss = resolveExpectedOs(expectedOs, {});
            const policyOss = resolveExpectedPolicyOs(expectedPolicyOs);
            await Promise.all([
                ...oss.map((os) =>
                    github.rest.repos.createCommitStatus({
                        owner: context.repo.owner,
                        repo: context.repo.repo,
                        sha: compositeIdentity.commit_sha,
                        state: 'failure',
                        context: osStatusContext(os),
                        description: 'TSIO reporting error — see workflow run for details',
                        target_url: errTarget,
                    }).catch((statusError) => {
                        core.warning(`Failed to create ${osStatusContext(os)} failure status: ${statusError.message}`);
                    }),
                ),
                ...policyOss.map((os) =>
                    github.rest.repos.createCommitStatus({
                        owner: context.repo.owner,
                        repo: context.repo.repo,
                        sha: compositeIdentity.commit_sha,
                        state: 'failure',
                        context: policyStatusContext(os),
                        description: 'TSIO reporting error — see workflow run for details',
                        target_url: errTarget,
                    }).catch((statusError) => {
                        core.warning(`Failed to create ${policyStatusContext(os)} failure status: ${statusError.message}`);
                    }),
                ),
            ]);
        }
        throw error;
    }

    if (!detail) {
        throw new Error('TSIO report status never returned after polling');
    }

    const stats = detail.test_stats || {};
    const isComplete = detail.status === 'completed';
    const isIncomplete = detail.status === 'incomplete';
    const uploadedShards = Array.isArray(detail.reports) ? detail.reports.length : 0;
    const failedShards = [];
    if (Array.isArray(detail.reports)) {
        for (const report of detail.reports) {
            if (report.status === 'failed') {
                failedShards.push(report.display_name || report.gh_job_name || report.id);
            }
        }
    }
    const hasFailures = (stats.failed || 0) > 0 || failedShards.length > 0;

    // Commit status / job outcome must reflect test + upstream CI health — not TSIO
    // consolidation lag. A stuck `in_progress` / `incomplete` group with 0 failed tests
    // previously flipped the commit status red and posted "Failed" with 0 failures.
    let overallState = 'failure';
    if (!hasFailures && upstreamJobsSucceeded) {
        overallState = 'success';
    }

    let targetUrl = runUrl;
    if (isComplete || isIncomplete || displayReportUrl || groupReportUrl) {
        targetUrl = displayReportUrl || groupReportUrl || runUrl;
    }

    const summaryLines = [
        `### Test System IO — ${compositeIdentity.name}`,
        '',
        `**Status:** ${detail.status} · **Report:** [this run](${groupReportUrl}) · [all runs for commit](${displayReportUrl})`,
        `**Tests:** ${stats.passed ?? '?'} passed, ${stats.failed ?? '?'} failed, ${stats.flaky ?? 0} flaky, ` +
            `${stats.skipped ?? '?'} skipped (of ${stats.total ?? '?'})`,
    ];

    if (uploadedShards > 0 || totalReportsExpected > 0) {
        summaryLines.push(`**Shards uploaded:** ${uploadedShards}/${totalReportsExpected}`);
    }

    if (failedShards.length > 0) {
        summaryLines.push(`**Failed shards:** ${failedShards.join(', ')}`);
    }

    if (!upstreamJobsSucceeded && !hasFailures) {
        summaryLines.push(
            '',
            ':warning: One or more CI jobs failed outside of any tracked test (e.g. a hung worker, a crashed runner) — forcing this status to failure even though the test stats above may show no failures.',
        );
    }

    if (isIncomplete) {
        summaryLines.push(
            '',
            `:warning: Report finalized as \`incomplete\` (${uploadedShards}/${totalReportsExpected} shards) — partial results are in the [TSIO report](${displayReportUrl}); see the [workflow run](${runUrl}) for missing legs.`,
        );
    } else if (!isComplete) {
        const shardsNote = uploadedShards >= totalReportsExpected && totalReportsExpected > 0 ?
            `All ${uploadedShards}/${totalReportsExpected} shards are uploaded; TSIO consolidation is still \`${detail.status}\`.` :
            `TSIO group still \`${detail.status}\` after polling (${uploadedShards}/${totalReportsExpected} shards).`;
        summaryLines.push(
            '',
            `:warning: ${shardsNote} Commit status follows upstream jobs and test failures, not TSIO consolidation — see the [workflow run](${runUrl}).`,
        );
    }

    summaryLines.push('');
    await core.summary.addRaw(summaryLines.join('\n')).write();

    const passedForStatus = (stats.passed ?? 0) + (stats.flaky ?? 0);
    const descriptionPrefix = !upstreamJobsSucceeded && !hasFailures ? 'CI job failed (untracked by TSIO), ' : '';
    const tsioLagSuffix = !isComplete && overallState === 'success' ? ' (TSIO consolidating)' : '';
    const description = `${descriptionPrefix}${passedForStatus}/${stats.total ?? 0} passed, ${stats.failed ?? 0} failed, ${stats.skipped ?? 0} skipped${tsioLagSuffix}`.slice(0, 140);

    if (commitStatusContext) {
        await github.rest.repos.createCommitStatus({
            owner: context.repo.owner,
            repo: context.repo.repo,
            sha: compositeIdentity.commit_sha,
            state: overallState,
            context: commitStatusContext,
            description,
            target_url: targetUrl,
        });
    }

    let perJobCounts = null;
    const overallFailed = stats.failed || 0;
    if (postPerOsCommitStatuses || readyWhenOs || readyWhenPolicy) {
        try {
            perJobCounts = await fetchPerJobCountsFromConsolidated(baseUrl, compositeIdentity, detail);
        } catch (error) {
            // Do not treat a failed fetch as zero results when there are no test
            // failures — that would flip e2e/<os> to error and clear pending.
            // If the group already has failures, post error instead of success.
            core.warning(
                overallFailed > 0 ?
                    `Could not load per-OS TSIO counts with test failures — marking e2e/<os> error: ${error.message}` :
                    `Could not load per-OS TSIO counts — leaving e2e/<os> statuses pending: ${error.message}`,
            );
            perJobCounts = null;
        }
        const byKeyForFlip = buildOsStatusTotals({detail, perJobCounts: perJobCounts || {}});
        const hasShardFailure = scopedHasShardFailure(byKeyForFlip, expectedOs, expectedPolicyOs);
        if (postPerOsCommitStatuses && (perJobCounts || !upstreamJobsSucceeded || hasShardFailure || overallFailed > 0)) {
            await flipPerOsCommitStatuses({
                github,
                context,
                compositeIdentity,
                detail,
                perJobCounts: perJobCounts || {},
                targetUrl,
                baseUrl,
                upstreamJobsSucceeded,
                expectedOs,
                expectedPolicyOs,
                readyWhenOs,
                readyWhenPolicy,
                minReports,
                hasPerJobCounts: perJobCounts != null,
                overallFailed,
                core,
            });
        }
    }

    // Channel notify (best-effort). Routing (see resolveWebhookUrl):
    //   cmt-desktop      → MM_E2E_RELEASE_WEBHOOK_URL
    //   desktop-master   → MM_E2E_MASTER_HEALTH_WEBHOOK_URL
    //   desktop-pr       → MM_DESKTOP_E2E_WEBHOOK_URL
    // Failures here must not undo a successfully written commit status.
    try {
        const notifyNames = new Set(['cmt-desktop', 'desktop-pr', 'desktop-master']);
        if (notifyChannel && notifyNames.has(compositeIdentity.name)) {
            const {notifyCmtChannel, resolveWebhookUrl} = require('./cmt-channel-notify.js');
            const webhookUrl = resolveWebhookUrl(compositeIdentity.name);
            if (webhookUrl) {
                // Prefer TSIO links even when the poll timed out at in_progress
                // (commit status may still point at the Actions run URL).
                const channelReportUrl = displayReportUrl || groupReportUrl || targetUrl;
                await notifyCmtChannel({
                    core,
                    baseUrl,
                    compositeIdentity,
                    detail,
                    reportUrl: channelReportUrl,
                    upstreamJobsSucceeded,
                    hasFailures,
                    webhookUrl,
                });
            }
        }
    } catch (error) {
        core.warning(`E2E Mattermost notify setup failed: ${error.message}`);
    }

    const byKey = buildOsStatusTotals({detail, perJobCounts: perJobCounts || {}});
    if (shouldFailFromScope({
        failOnTestFailures,
        readyWhenOs,
        readyWhenPolicy,
        overallState,
        byKey,
        upstreamJobsSucceeded,
        minReports,
        detail,
        hasPerJobCounts: perJobCounts != null,
        overallFailed,
        perJobCounts: perJobCounts || {},
    })) {
        let reason;
        if (readyWhenOs) {
            const row = byKey[readyWhenOs] || EMPTY_OS_ROW;
            if (!upstreamJobsSucceeded && row.failed === 0 && !row.shardFailed) {
                reason = `an upstream CI job failed with no corresponding test failure (${readyWhenOs})`;
            } else {
                reason = `${readyWhenOs}: ${row.passed} passed, ${row.failed} failed, shardFailed=${row.shardFailed}`;
            }
        } else if (readyWhenPolicy) {
            reason = 'one or more policy legs did not pass';
        } else if (!upstreamJobsSucceeded && !hasFailures) {
            reason = 'an upstream CI job failed with no corresponding test failure';
        } else if (failedShards.length > 0 && (stats.failed || 0) === 0) {
            reason = `shard(s) failed: ${failedShards.join(', ')}`;
        } else {
            reason = `status=${detail.status}, failed=${stats.failed || 0}`;
        }
        throw new Error(`TSIO report ${reportId} did not pass: ${reason}`);
    }

    if (!isComplete && overallState === 'success') {
        core.warning(
            `TSIO group left at status=${detail.status} with 0 test failures — commit status set to success. ` +
            `Shards ${uploadedShards}/${totalReportsExpected}.`,
        );
    }

    return {reportUrl: displayReportUrl || groupReportUrl, status: detail.status, stats};
}

module.exports = reportTsioStatus;
module.exports.buildOsStatusTotals = buildOsStatusTotals;
module.exports.flipPerOsCommitStatuses = flipPerOsCommitStatuses;
module.exports.reportUrlForStatusBucket = reportUrlForStatusBucket;
module.exports.countReportsForBucket = countReportsForBucket;
module.exports.shardsAreReady = shardsAreReady;
module.exports.shouldFailFromScope = shouldFailFromScope;
module.exports.statusFromTotals = statusFromTotals;
module.exports.scopedHasShardFailure = scopedHasShardFailure;
module.exports.hasCountsForEveryUploadedReport = hasCountsForEveryUploadedReport;
module.exports.shouldPostPerOsCommitStatuses = shouldPostPerOsCommitStatuses;
