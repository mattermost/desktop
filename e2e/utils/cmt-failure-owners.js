// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Blame failing E2E specs and format owners for the Mattermost channel report.
 *
 * Pipeline: Playwright stack → repo path/line → GitHub GraphQL blame (else last
 * commit on the file) → GitHub login → Mattermost @mention only when the login
 * is listed in github-to-mattermost.js or secret MM_GITHUB_USERNAME_MAP.
 * GitHub login is never used as an @mention by itself.
 */

const MAX_FAILING_SPECS_IN_MESSAGE = 12;
const MATTERMOST_USERNAME_RE = /^[a-z0-9.\-_]+$/i;
const GITHUB_LOGIN_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;

/** Accounts that authored CI/merge commits — never ping these as "who broke the test". */
const GITHUB_BOT_LOGINS = new Set([
    'web-flow',
    'github-actions',
    'github-actions[bot]',
    'dependabot',
    'dependabot[bot]',
    'cursor[bot]',
    'coderabbitai[bot]',
    'copilot-swe-agent[bot]',
]);

const OS_EMOJI = {
    linux: '🐧',
    macos: '🍎',
    windows: '🪟',
    unknown: '❔',
};

const BLAME_QUERY = `
query BlameFile($owner: String!, $repo: String!, $sha: GitObjectID!, $path: String!) {
  repository(owner: $owner, name: $repo) {
    object(oid: $sha) {
      ... on Commit {
        blame(path: $path) {
          ranges {
            startingLine
            endingLine
            commit {
              author {
                user { login }
              }
            }
          }
        }
      }
    }
  }
}
`;

/**
 * Playwright stack → repo-relative file + line. Prefers e2e/specs, then e2e/helpers, then src.
 *
 * @param {string} [errorMessage]
 * @returns {{file: string, line: number}|null}
 */
function extractSpecLocation(errorMessage) {
    if (!errorMessage) {
        return null;
    }

    const normalized = String(errorMessage).replace(/\\/g, '/');
    const matches = [...normalized.matchAll(/((?:e2e|src)\/[A-Za-z0-9_./-]+\.(?:ts|js|tsx|jsx)):(\d+)/g)];
    if (matches.length === 0) {
        return null;
    }

    const preferred = matches.find((match) => match[1].startsWith('e2e/specs/')) ||
        matches.find((match) => match[1].startsWith('e2e/helpers/')) ||
        matches[0];
    return {file: preferred[1], line: Number.parseInt(preferred[2], 10)};
}

/**
 * @param {string} [fullTitle]
 * @returns {string}
 */
function shortFailingTestTitle(fullTitle) {
    const title = String(fullTitle || '').trim();
    if (!title) {
        return 'unknown test';
    }
    const separator = ' › ';
    const idx = title.lastIndexOf(separator);
    const short = idx >= 0 ? title.slice(idx + separator.length) : title;
    return short.length > 90 ? `${short.slice(0, 87)}...` : short;
}

/**
 * @param {string} [login]
 * @returns {boolean}
 */
function isHumanGithubLogin(login) {
    if (!login || typeof login !== 'string') {
        return false;
    }
    const trimmed = login.trim();
    if (!GITHUB_LOGIN_RE.test(trimmed)) {
        return false;
    }
    const lower = trimmed.toLowerCase();
    if (GITHUB_BOT_LOGINS.has(lower) || lower.endsWith('[bot]')) {
        return false;
    }
    return true;
}

/**
 * @param {string} [username]
 * @returns {string|undefined}
 */
function sanitizeMattermostUsername(username) {
    if (!username || typeof username !== 'string') {
        return undefined;
    }
    const trimmed = username.trim().replace(/^@/, '');
    if (!MATTERMOST_USERNAME_RE.test(trimmed)) {
        return undefined;
    }
    return trimmed;
}

/**
 * File map plus optional `MM_GITHUB_USERNAME_MAP` JSON (env wins on key conflict).
 * Never infers a Mattermost username from a GitHub login.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {(id: string) => unknown} [loadModule]
 * @returns {Record<string, string>}
 */
function loadGithubToMattermostMap(env = process.env, loadModule = require) {
    let fromFile = {};
    try {
        const loaded = loadModule('./github-to-mattermost.js');
        if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) {
            fromFile = loaded;
        }
    } catch {
        fromFile = {};
    }

    let fromEnv = {};
    const raw = env.MM_GITHUB_USERNAME_MAP;
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                fromEnv = parsed;
            }
        } catch {
            fromEnv = {};
        }
    }

    /** @type {Record<string, string>} */
    const merged = {};
    for (const [login, username] of Object.entries({...fromFile, ...fromEnv})) {
        const sanitized = sanitizeMattermostUsername(username);
        if (isHumanGithubLogin(login) && sanitized) {
            merged[login] = sanitized;
        }
    }
    return merged;
}

/**
 * @param {{githubLogin?: string, mattermostUsername?: string}} spec
 * @returns {string}
 */
function formatOwnerCell(spec) {
    const login = spec?.githubLogin;
    const mention = spec?.mattermostUsername;
    if (mention && login) {
        return `@${mention} ([\`${login}\`](https://github.com/${login}))`;
    }
    if (mention) {
        return `@${mention}`;
    }
    if (login) {
        return `[\`${login}\`](https://github.com/${login})`;
    }
    return '—';
}

/**
 * @param {Array<{title?: string, osList?: string[], githubLogin?: string, mattermostUsername?: string}>} [failingSpecs]
 * @returns {string[]}
 */
function formatFailingTestsSection(failingSpecs) {
    if (!Array.isArray(failingSpecs) || failingSpecs.length === 0) {
        return [];
    }

    const shown = failingSpecs.slice(0, MAX_FAILING_SPECS_IN_MESSAGE);
    const lines = [
        '| Test | OS | Last touched |',
        '|------|----|--------------|',
    ];
    for (const spec of shown) {
        const os = (spec.osList || []).
            map((name) => OS_EMOJI[name] || OS_EMOJI.unknown).
            join(' ') || '—';
        lines.push(`| ${shortFailingTestTitle(spec.title)} | ${os} | ${formatOwnerCell(spec)} |`);
    }
    if (failingSpecs.length > shown.length) {
        lines.push(`| _+${failingSpecs.length - shown.length} more_ | | |`);
    }

    const mapped = [...new Set(
        failingSpecs.
            map((spec) => spec.mattermostUsername).
            filter(Boolean),
    )];
    const unmapped = [...new Set(
        failingSpecs.
            filter((spec) => spec.githubLogin && !spec.mattermostUsername).
            map((spec) => spec.githubLogin),
    )];

    if (mapped.length > 0) {
        lines.push('', `cc: ${mapped.map((name) => `@${name}`).join(' ')}`);
    }
    if (unmapped.length > 0) {
        const names = unmapped.map((login) => `\`${login}\``).join(', ');
        lines.push(
            '',
            `_GitHub authors without a Mattermost mapping (add to \`e2e/utils/github-to-mattermost.js\` or secret \`MM_GITHUB_USERNAME_MAP\`): ${names}._`,
        );
    }

    return lines;
}

/**
 * @param {Object} params
 * @param {Object} params.github
 * @param {string} params.owner
 * @param {string} params.repo
 * @param {string} params.sha
 * @param {string} params.file
 * @param {number} [params.line]
 * @returns {Promise<string|null>}
 */
async function githubLoginForFileLine({github, owner, repo, sha, file, line}) {
    if (!github || !owner || !repo || !sha || !file) {
        return null;
    }

    if (Number.isInteger(line) && typeof github.graphql === 'function') {
        try {
            const data = await github.graphql(BLAME_QUERY, {owner, repo, sha, path: file});
            const ranges = data?.repository?.object?.blame?.ranges || [];
            const range = ranges.find((entry) => line >= entry.startingLine && line <= entry.endingLine);
            const login = range?.commit?.author?.user?.login;
            if (isHumanGithubLogin(login)) {
                return login;
            }
        } catch {
            // Fall through to last-commit-on-file.
        }
    }

    if (github.rest?.repos?.listCommits) {
        const response = await github.rest.repos.listCommits({
            owner,
            repo,
            sha,
            path: file,
            per_page: 1,
        });
        const login = response?.data?.[0]?.author?.login;
        if (isHumanGithubLogin(login)) {
            return login;
        }
    }

    return null;
}

/**
 * git blame (GraphQL) → GitHub login → optional Mattermost username from the map.
 *
 * @param {Object} params
 * @param {Object} [params.github]
 * @param {Object} [params.context]
 * @param {string} params.commitSha
 * @param {Array<{file?: string, line?: number, githubLogin?: string, mattermostUsername?: string}>} params.failedSpecs
 * @param {Record<string, string>} [params.usernameMap]
 * @param {Object} [params.core]
 */
async function attachOwnersToFailedSpecs({
    github,
    context,
    commitSha,
    failedSpecs,
    usernameMap,
    core,
}) {
    if (!Array.isArray(failedSpecs) || failedSpecs.length === 0) {
        return failedSpecs;
    }

    const map = usernameMap || loadGithubToMattermostMap();
    const owner = context?.repo?.owner;
    const repo = context?.repo?.repo;
    const cache = new Map();

    for (const spec of failedSpecs) {
        if (!spec.file || !github) {
            continue;
        }
        const cacheKey = `${spec.file}:${spec.line || ''}`;
        let login = cache.get(cacheKey);
        if (login === undefined) {
            try {
                login = await githubLoginForFileLine({
                    github,
                    owner,
                    repo,
                    sha: commitSha,
                    file: spec.file,
                    line: spec.line,
                });
            } catch (error) {
                core?.warning?.(`Could not blame ${spec.file}: ${error.message}`);
                login = null;
            }
            cache.set(cacheKey, login);
        }
        if (!login) {
            continue;
        }
        spec.githubLogin = login;
        spec.mattermostUsername = map[login];
    }

    return failedSpecs;
}

module.exports = {
    extractSpecLocation,
    shortFailingTestTitle,
    loadGithubToMattermostMap,
    formatFailingTestsSection,
    githubLoginForFileLine,
    attachOwnersToFailedSpecs,
};
