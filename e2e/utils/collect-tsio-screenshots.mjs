// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Build a screenshots dir for TSIO that contains only Playwright failure images.
 *
 * The report-upload action recursively uploads every .png/.jpg under
 * screenshots-dir. Our Electron userdata lives under e2e/test-results/<test>/userdata,
 * so pointing TSIO at e2e/test-results uploads thousands of cache/icon PNGs.
 * This script copies only image attachments from failed/timedOut results.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

const DEFAULT_RESULTS = path.join('e2e', 'test-results', 'results.json');
const DEFAULT_OUT = path.join('e2e', 'test-results', 'tsio-screenshots');

const FAILURE_STATUSES = new Set(['failed', 'timedOut', 'interrupted']);

/**
 * @param {unknown} node
 * @param {(result: {status?: string, attachments?: Array<{name?: string, path?: string, contentType?: string}>}) => void} visit
 */
function walkResults(node, visit) {
    if (!node || typeof node !== 'object') {
        return;
    }
    const obj = /** @type {Record<string, unknown>} */ (node);
    if (Array.isArray(obj.results)) {
        for (const result of obj.results) {
            visit(/** @type {{status?: string, attachments?: Array<{name?: string, path?: string, contentType?: string}>}} */ (result));
        }
    }
    for (const key of ['suites', 'specs', 'tests']) {
        if (Array.isArray(obj[key])) {
            for (const child of obj[key]) {
                walkResults(child, visit);
            }
        }
    }
}

/**
 * @param {string} contentType
 * @param {string} filePath
 * @returns {boolean}
 */
function isImageAttachment(contentType, filePath) {
    if ((contentType || '').startsWith('image/')) {
        return true;
    }
    return /\.(png|jpe?g)$/i.test(filePath || '');
}

/**
 * @param {object} opts
 * @param {string} [opts.resultsPath]
 * @param {string} [opts.outDir]
 * @returns {{copied: number, skippedMissing: number, outDir: string}}
 */
export function collectTsioScreenshots({
    resultsPath = process.env.TSIO_RESULTS_JSON || DEFAULT_RESULTS,
    outDir = process.env.TSIO_SCREENSHOTS_OUT || DEFAULT_OUT,
} = {}) {
    fs.rmSync(outDir, {recursive: true, force: true});
    fs.mkdirSync(outDir, {recursive: true});

    if (!fs.existsSync(resultsPath)) {
        console.log(`No results JSON at ${resultsPath}; wrote empty ${outDir}`);
        return {copied: 0, skippedMissing: 0, outDir};
    }

    const report = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    /** @type {Map<string, {absPath: string, destName: string}>} */
    const selected = new Map();
    let skippedMissing = 0;
    let index = 0;

    walkResults(report, (result) => {
        if (!FAILURE_STATUSES.has(result.status || '')) {
            return;
        }
        for (const attachment of result.attachments || []) {
            const absPath = attachment.path;
            if (!absPath || !isImageAttachment(attachment.contentType || '', absPath)) {
                continue;
            }
            if (!fs.existsSync(absPath)) {
                skippedMissing += 1;
                continue;
            }
            if (selected.has(absPath)) {
                continue;
            }
            index += 1;
            const ext = path.extname(absPath) || '.png';
            const base = path.basename(absPath, ext).replace(/[^\w.-]+/g, '_');
            const destName = `${String(index).padStart(3, '0')}-${base}${ext}`;
            selected.set(absPath, {absPath, destName});
        }
    });

    for (const {absPath, destName} of selected.values()) {
        fs.copyFileSync(absPath, path.join(outDir, destName));
    }

    console.log(
        `Collected ${selected.size} failure screenshot(s) into ${outDir}` +
            (skippedMissing ? ` (${skippedMissing} missing on disk)` : ''),
    );
    return {copied: selected.size, skippedMissing, outDir};
}

const isDirectRun = process.argv[1] &&
    path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
    collectTsioScreenshots();
}
