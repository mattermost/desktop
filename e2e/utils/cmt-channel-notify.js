// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable no-console -- Logging is intentional in CI utility scripts */

/**
 * Post a CMT rollup to a Mattermost incoming webhook.
 *
 * Expected job names from e2e-functional-template.yml:
 *   e2e-on-{runner}-{serverVersion}
 * e.g. e2e-on-ubuntu-latest-11.9.0, e2e-on-windows-2022-10.5.14
 *
 * Per-leg pass/fail counts come from TSIO consolidated specs grouped by
 * contributing report id → gh_job_name (group report only has upload status).
 */

const OS_ORDER = {linux: 0, macos: 1, windows: 2};
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Fetch with an abort timeout that stays armed until `readBody` finishes
 * (headers + body), so a stalled `res.json()`/`res.text()` cannot hang CI.
 *
 * @template T
 * @param {string} url
 * @param {RequestInit | undefined} options
 * @param {(res: Response) => Promise<T>} readBody
 * @param {number} [timeoutMs]
 * @returns {Promise<T>}
 */
async function fetchWithTimeout(url, options, readBody, timeoutMs = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {...(options || {}), signal: controller.signal});
        return await readBody(res);
    } finally {
        clearTimeout(timer);
    }
}

/**
 * @param {string} token
 * @returns {string}
 */
function osFromRunnerToken(token) {
    if (token.startsWith('ubuntu') || token.startsWith('linux')) {
        return 'linux';
    }
    if (token.startsWith('windows')) {
        return 'windows';
    }
    if (token.startsWith('macos') || token.startsWith('darwin')) {
        return 'macos';
    }
    return 'unknown';
}

function parseCmtJobName(jobName) {
    if (!jobName || typeof jobName !== 'string') {
        return null;
    }

    // PR/master policy legs: policy-tests-macos / policy-tests-windows
    const policyMatch = jobName.match(/^policy-tests-(macos|windows|linux)$/);
    if (policyMatch) {
        return {
            os: policyMatch[1] === 'linux' ? 'linux' : policyMatch[1],
            serverVersion: 'policy',
            runner: policyMatch[1],
            kind: 'policy',
        };
    }

    // Server versions may include pre-release: 11.9.0-rc.3
    const match = jobName.match(/^e2e-on-(.+)-(\d+\.\d+\.\d+(?:[-.][\w.]+)?)$/);
    if (!match) {
        return null;
    }

    const runner = match[1];
    return {
        os: osFromRunnerToken(runner),
        serverVersion: match[2],
        runner,
        kind: 'e2e',
    };
}

/**
 * Webhook routing:
 *   cmt-desktop + desktop-master → MM_DESKTOP_CMT_WEBHOOK_URL (RC / master channel)
 *   desktop-pr                   → MM_DESKTOP_E2E_WEBHOOK_URL (PR channel)
 *
 * MATTERMOST_WEBHOOK_URL remains a fallback for workflows that set only one URL.
 *
 * @param {string} reportName - compositeIdentity.name
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
function resolveWebhookUrl(reportName, env = process.env) {
    if (reportName === 'cmt-desktop' || reportName === 'desktop-master') {
        return env.MATTERMOST_CMT_WEBHOOK_URL || env.MATTERMOST_WEBHOOK_URL || '';
    }
    if (reportName === 'desktop-pr') {
        return env.MATTERMOST_E2E_WEBHOOK_URL || env.MATTERMOST_WEBHOOK_URL || '';
    }
    return env.MATTERMOST_WEBHOOK_URL || '';
}

/**
 * Individual leg UI path in TSIO: /reports/r/{id}
 * (see mattermost-test-system-io apps/web Route path="/reports/r/:id").
 *
 * @param {string} baseUrl
 * @param {string} reportId
 * @returns {string}
 */
function buildIndividualReportUrl(baseUrl, reportId) {
    return `${baseUrl.replace(/\/$/, '')}/reports/r/${reportId}`;
}

/**
 * @param {Record<string, {passed?: number, failed?: number, skipped?: number, flaky?: number}>} perJobCounts
 * @param {Array<{id?: string, gh_job_name?: string, display_name?: string, status?: string}>} uploadedReports
 * @param {string} [baseUrl] - TSIO origin used to build per-leg report links
 * @returns {Array<{label: string, status: string, passed: number, failed: number, skipped: number, total: number, os: string, serverVersion: string, reportUrl?: string}>}
 */
function buildLegSummaries(perJobCounts, uploadedReports, baseUrl) {
    const jobNames = new Set([
        ...Object.keys(perJobCounts || {}),
        ...(uploadedReports || []).map((r) => r.gh_job_name || r.display_name).filter(Boolean),
    ]);

    const rows = [];
    for (const jobName of jobNames) {
        const parsed = parseCmtJobName(jobName);
        if (!parsed) {
            continue;
        }

        const counts = perJobCounts[jobName] || {};
        const passed = (counts.passed || 0) + (counts.flaky || 0);
        const failed = counts.failed || 0;
        const skipped = counts.skipped || 0;
        const total = passed + failed + skipped;
        const uploaded = (uploadedReports || []).find(
            (r) => (r.gh_job_name || r.display_name) === jobName,
        );

        let status;
        if (total === 0) {
            const uploadedOk = uploaded?.status === 'complete' || uploaded?.status === 'completed';
            status = uploadedOk ? 'no-results' : 'missing';
        } else {
            status = failed === 0 ? 'passed' : 'failed';
        }

        rows.push({
            label: `${parsed.serverVersion}-${parsed.os}`,
            status,
            passed,
            failed,
            skipped,
            total,
            os: parsed.os,
            serverVersion: parsed.serverVersion,
            kind: parsed.kind || 'e2e',
            reportUrl: uploaded?.id && baseUrl ? buildIndividualReportUrl(baseUrl, uploaded.id) : undefined,
        });
    }

    rows.sort((a, b) => {
        const osCmp = (OS_ORDER[a.os] ?? 9) - (OS_ORDER[b.os] ?? 9);
        if (osCmp !== 0) {
            return osCmp;
        }
        if (a.kind !== b.kind) {
            return a.kind === 'policy' ? 1 : -1;
        }
        return a.serverVersion.localeCompare(b.serverVersion, undefined, {numeric: true});
    });

    return rows;
}

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

/**
 * @param {{os: string, kind?: string, serverVersion: string}} leg
 * @returns {{platform: string, suite: string}}
 */
function formatLegLabels(leg) {
    const emoji = PLATFORM_EMOJI[leg.os] || PLATFORM_EMOJI.unknown;
    const name = PLATFORM_LABEL[leg.os] || PLATFORM_LABEL.unknown;
    const suite = leg.kind === 'policy' ? 'Policy' : `Server \`${leg.serverVersion}\``;
    return {platform: `${emoji} ${name}`, suite};
}

/**
 * Denominator is executed tests (passed + failed), matching Playwright summary style.
 *
 * @param {{status: string, passed: number, failed: number, skipped?: number}} leg
 * @returns {string}
 */
function formatLegResultText(leg) {
    if (leg.status === 'missing' || leg.status === 'no-results') {
        return `⚠️ ${leg.status}`;
    }

    // All-skipped legs are marked "passed" by buildLegSummaries (failed === 0) but
    // should not render as ✅ 0/0.
    if ((leg.passed || 0) === 0 && (leg.failed || 0) === 0 && (leg.skipped || 0) > 0) {
        return '⚠️ not executed';
    }
    const executed = leg.passed + leg.failed;
    if (leg.status === 'passed') {
        return `✅ ${leg.passed}/${executed || leg.passed}`;
    }
    return `❌ ${leg.passed}/${executed}`;
}

function reportTitleForIdentity(compositeIdentity) {
    switch (compositeIdentity?.name) {
    case 'cmt-desktop':
        return 'Desktop CMT';
    case 'desktop-pr':
        return 'Desktop PR E2E';
    case 'desktop-master':
        return 'Desktop Master E2E';
    default:
        return 'Desktop E2E';
    }
}

/**
 * @param {Object} compositeIdentity
 * @returns {string}
 */
function formatMetaLine(compositeIdentity) {
    const branch = (compositeIdentity.branch || '').replace(/^refs\/(heads|tags)\//, '');
    const shortSha = (compositeIdentity.commit_sha || '').slice(0, 7);
    const parts = [];

    if (compositeIdentity.gh_pr_number) {
        const repo = compositeIdentity.repository || 'mattermost/desktop';
        parts.push(`**PR:** [#${compositeIdentity.gh_pr_number}](https://github.com/${repo}/pull/${compositeIdentity.gh_pr_number})`);
    }
    if (branch) {
        parts.push(`**Branch:** \`${branch}\``);
    }
    if (shortSha) {
        parts.push(`**Commit:** \`${shortSha}\``);
    }
    return parts.join(' · ');
}

/**
 * @param {Object} params
 * @param {Object} params.compositeIdentity
 * @param {Object} params.detail - TSIO group report detail
 * @param {string} params.reportUrl - group / consolidated rollup URL
 * @param {string} [params.baseUrl] - TSIO origin for per-leg /reports/r/{id} links
 * @param {Record<string, {passed?: number, failed?: number, skipped?: number, flaky?: number}>} params.perJobCounts
 * @param {boolean} [params.upstreamJobsSucceeded]
 * @param {boolean} [params.hasFailures] - true when TSIO reports failed shards or failed tests
 * @returns {string}
 */
function formatCmtChannelMessage({
    compositeIdentity,
    detail,
    reportUrl,
    baseUrl,
    perJobCounts,
    upstreamJobsSucceeded = true,
    hasFailures = false,
}) {
    const stats = detail?.test_stats || {};

    // Match buildLegSummaries: fold flaky into passed so the headline matches per-leg totals.
    const passed = (stats.passed ?? 0) + (stats.flaky ?? 0);
    const failed = stats.failed ?? 0;
    const skipped = stats.skipped ?? 0;
    const overallFailed = failed > 0 ||
        detail?.status !== 'completed' ||
        !upstreamJobsSucceeded ||
        hasFailures;
    const title = reportTitleForIdentity(compositeIdentity);
    const legs = buildLegSummaries(perJobCounts, detail?.reports || [], baseUrl);

    const lines = [
        `## ${overallFailed ? '❌' : '✅'} ${title}`,
        '',
    ];

    const meta = formatMetaLine(compositeIdentity);
    if (meta) {
        lines.push(meta, '');
    }

    if (failed > 0) {
        const failingLegs = legs.filter((leg) => leg.status === 'failed' && leg.failed > 0);
        lines.push(`🔴 **${failed} failing test${failed === 1 ? '' : 's'}**`, '');
        if (failingLegs.length > 0) {
            lines.push('| Platform | Suite | Failed |', '|----------|-------|-------:|');
            for (const leg of failingLegs) {
                const {platform, suite} = formatLegLabels(leg);
                lines.push(`| ${platform} | ${suite} | ${leg.failed} |`);
            }
            lines.push('');
        }
    }

    lines.push(
        '| Overall | Passed | Failed | Skipped |',
        '|---------|------:|------:|-------:|',
        `| ${overallFailed ? '❌ Failed' : '✅ Passed'} | **${passed}** | **${failed}** | **${skipped}** |`,
        '',
    );

    if (legs.length > 0) {
        lines.push('<details>', '<summary><strong>Detailed results</strong></summary>', '');
        lines.push('| Platform | Suite | Result | Report |', '|----------|-------|--------|--------|');
        for (const leg of legs) {
            const {platform, suite} = formatLegLabels(leg);
            const report = leg.reportUrl ? `[View](${leg.reportUrl})` : '—';
            lines.push(`| ${platform} | ${suite} | ${formatLegResultText(leg)} | ${report} |`);
        }
        lines.push('', '</details>', '');
    } else {
        lines.push('_No per-leg results available yet._', '');
    }

    if (!upstreamJobsSucceeded) {
        lines.push('_One or more CI jobs failed outside tracked tests (install/build/teardown)._', '');
    }

    if (reportUrl) {
        lines.push(`➡️ **Full report:** ${reportUrl}`);
    }

    return lines.join('\n').trimEnd() + '\n';
}

/**
 * @param {string} baseUrl
 * @param {Object} compositeIdentity
 * @param {Object} groupDetail
 * @returns {Promise<Record<string, {passed: number, failed: number, skipped: number, flaky: number}>>}
 */
async function fetchPerJobCountsFromConsolidated(baseUrl, compositeIdentity, groupDetail) {
    const idToJob = {};
    for (const report of groupDetail.reports || []) {
        const name = report.gh_job_name || report.display_name;
        if (report.id && name) {
            idToJob[report.id] = name;
        }
    }

    const repoTrailing = (compositeIdentity.repository || '').split('/').pop() || compositeIdentity.repository;
    const params = new URLSearchParams({
        repository: repoTrailing,
        branch: (compositeIdentity.branch || '').replace(/^refs\/(heads|tags)\//, ''),
        commit: compositeIdentity.commit_sha,
        name: compositeIdentity.name,
        gh_run_id: String(compositeIdentity.gh_run_id),
    });
    if (compositeIdentity.gh_run_attempt) {
        params.set('gh_run_attempt', String(compositeIdentity.gh_run_attempt));
    }

    const consol = await fetchWithTimeout(
        `${baseUrl}/api/v1/reports/consolidated?${params}`,
        undefined,
        async (res) => {
            if (!res.ok) {
                throw new Error(`consolidated fetch failed: ${res.status} ${await res.text()}`);
            }
            return res.json();
        },
    );

    const counts = {};
    const commitSha = compositeIdentity.commit_sha;
    const attempt = Number.parseInt(compositeIdentity.gh_run_attempt || '1', 10);

    for (const spec of consol.specs || []) {
        for (const entry of spec.history || []) {
            if (entry.commit_sha !== commitSha) {
                continue;
            }
            if (Number.parseInt(entry.run_attempt || '0', 10) !== attempt) {
                continue;
            }
            const job = idToJob[entry.report_id];
            if (!job) {
                continue;
            }
            if (!counts[job]) {
                counts[job] = {passed: 0, failed: 0, skipped: 0, flaky: 0};
            }
            const status = entry.status || 'failed';
            if (Object.prototype.hasOwnProperty.call(counts[job], status)) {
                counts[job][status] += 1;
            } else {
                counts[job].failed += 1;
            }
        }
    }

    return counts;
}

/**
 * @param {Object} params
 * @param {Object} params.core
 * @param {string} params.webhookUrl
 * @param {string} params.text
 * @param {string} [params.username]
 */
async function postMattermostWebhook({core, webhookUrl, text, username = 'Desktop E2E'}) {
    if (!webhookUrl) {
        core.info('MATTERMOST_WEBHOOK_URL not set — skipping E2E channel notify');
        return;
    }

    const body = {
        username,
        icon_url: 'https://mattermost.com/wp-content/uploads/2022/02/icon.png',
        text,
    };

    await fetchWithTimeout(
        webhookUrl,
        {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body),
        },
        async (res) => {
            if (!res.ok) {
                throw new Error(`Mattermost webhook failed: ${res.status} ${await res.text()}`);
            }

            // Drain body so the abort timer covers the full response, not just headers.
            await res.text();
        },
    );
    core.info('Posted E2E summary to Mattermost channel');
}

/**
 * Build + post the CMT channel message. Never throws to the caller — notify is best-effort.
 *
 * @param {Object} params
 * @param {Object} params.core
 * @param {string} params.baseUrl
 * @param {Object} params.compositeIdentity
 * @param {Object} params.detail
 * @param {string} params.reportUrl
 * @param {boolean} [params.upstreamJobsSucceeded]
 * @param {boolean} [params.hasFailures]
 * @param {string} [params.webhookUrl]
 */
async function notifyCmtChannel({
    core,
    baseUrl,
    compositeIdentity,
    detail,
    reportUrl,
    upstreamJobsSucceeded = true,
    hasFailures = false,
    webhookUrl,
}) {
    try {
        const resolvedWebhook = webhookUrl || resolveWebhookUrl(compositeIdentity?.name);
        let perJobCounts = {};
        try {
            perJobCounts = await fetchPerJobCountsFromConsolidated(baseUrl, compositeIdentity, detail);
        } catch (error) {
            core.warning(`Could not load per-leg TSIO counts: ${error.message}`);
        }

        const text = formatCmtChannelMessage({
            compositeIdentity,
            detail,
            reportUrl,
            baseUrl,
            perJobCounts,
            upstreamJobsSucceeded,
            hasFailures,
        });

        await postMattermostWebhook({core, webhookUrl: resolvedWebhook, text});
    } catch (error) {
        core.warning(`E2E Mattermost notify failed: ${error.message}`);
    }
}

module.exports = {
    parseCmtJobName,
    resolveWebhookUrl,
    buildIndividualReportUrl,
    buildLegSummaries,
    formatLegResultText,
    reportTitleForIdentity,
    formatCmtChannelMessage,
    fetchPerJobCountsFromConsolidated,
    postMattermostWebhook,
    notifyCmtChannel,
};
