// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFileSync} from 'child_process';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {parseCursorAutomationServerUrlFromBody} = require('../utils/github-actions') as {
    parseCursorAutomationServerUrlFromBody: (body: string) => string | null;
};

function parsePrNumberFromGithubRef(): number | null {
    const ref = process.env.GITHUB_REF?.trim();
    if (!ref) {
        return null;
    }
    const m = (/^refs\/pull\/(\d+)\//).exec(ref);
    if (!m) {
        return null;
    }
    const n = parseInt(m[1], 10);
    return Number.isNaN(n) || n < 1 ? null : n;
}

function resolvePrNumber(): number | null {
    const raw =
        process.env.MM_TEST_PR_NUMBER?.trim() ||
        process.env.GITHUB_PR_NUMBER?.trim() ||
        process.env.PR_NUMBER?.trim();
    if (raw) {
        const n = parseInt(raw, 10);
        if (Number.isNaN(n) || n < 1) {
            // eslint-disable-next-line no-console
            console.warn(`[e2e] Ignoring invalid PR number for MM_TEST_SERVER_URL resolution: ${raw}`);
            return null;
        }
        return n;
    }
    return parsePrNumberFromGithubRef();
}

function resolveOwnerRepo(): {owner: string; repo: string} | null {
    const full = process.env.GITHUB_REPOSITORY?.trim();
    if (full && full.includes('/')) {
        const i = full.indexOf('/');
        return {owner: full.slice(0, i), repo: full.slice(i + 1)};
    }
    const owner = process.env.MM_TEST_GITHUB_OWNER?.trim();
    const repo = process.env.MM_TEST_GITHUB_REPO?.trim();
    if (owner && repo) {
        return {owner, repo};
    }
    return null;
}

async function fetchPrBodyFromGitHubApi(owner: string, repo: string, prNumber: number): Promise<string | null> {
    const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
    const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
    try {
        const res = await fetch(apiUrl, {headers});
        if (!res.ok) {
            // eslint-disable-next-line no-console
            console.warn(
                `[e2e] GitHub API GET pulls/${prNumber} returned HTTP ${res.status}; will try gh CLI if available.`,
            );
            return null;
        }
        const data = (await res.json()) as {body?: string | null};
        return data.body ?? null;
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[e2e] GitHub API fetch failed:', e);
        return null;
    }
}

function fetchPrBodyFromGhCli(prNumber: number, ownerRepo?: {owner: string; repo: string}): string | null {
    try {
        const args = ['pr', 'view', String(prNumber), '--json', 'body', '-q', '.body'];
        if (ownerRepo) {
            args.push('-R', `${ownerRepo.owner}/${ownerRepo.repo}`);
        }
        const out = execFileSync(
            'gh',
            args,
            {encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 10 * 1024 * 1024},
        );
        const body = out.trim();
        return body.length > 0 ? body : null;
    } catch {
        return null;
    }
}

/**
 * When MM_TEST_SERVER_URL is unset, load it from the PR body line
 * "Server for Cursor Automation: <url>" (same format CI writes). Requires a PR
 * number (MM_TEST_PR_NUMBER, GITHUB_PR_NUMBER, PR_NUMBER, or GITHUB_REF=refs/pull/N/…)
 * and either GITHUB_REPOSITORY, MM_TEST_GITHUB_OWNER+REPO, or a working `gh` CLI
 * (CLI fallback uses `gh pr view -R owner/repo` when that repo is known).
 */
export async function resolveMmTestServerUrlFromPrIfNeeded(): Promise<void> {
    if (process.env.MM_TEST_SERVER_URL?.trim()) {
        return;
    }

    const prNumber = resolvePrNumber();
    if (!prNumber) {
        return;
    }

    const ownerRepo = resolveOwnerRepo();
    let body: string | null = null;
    if (ownerRepo) {
        body = await fetchPrBodyFromGitHubApi(ownerRepo.owner, ownerRepo.repo, prNumber);
    }
    if (!body) {
        body = fetchPrBodyFromGhCli(prNumber, ownerRepo ?? undefined);
    }

    if (!body) {
        // eslint-disable-next-line no-console
        console.warn(
            `[e2e] Could not load PR #${prNumber} body (set GITHUB_REPOSITORY + GITHUB_TOKEN, or install auth'd gh). MM_TEST_SERVER_URL remains unset.`,
        );
        return;
    }

    const url = parseCursorAutomationServerUrlFromBody(body);
    if (url) {
        process.env.MM_TEST_SERVER_URL = url;
        // eslint-disable-next-line no-console
        console.log('[e2e] MM_TEST_SERVER_URL set from PR body (Server for Cursor Automation line).');
        return;
    }

    // eslint-disable-next-line no-console
    console.warn(
        `[e2e] PR #${prNumber} has no usable "Server for Cursor Automation:" URL line; MM_TEST_SERVER_URL remains unset.`,
    );
}
