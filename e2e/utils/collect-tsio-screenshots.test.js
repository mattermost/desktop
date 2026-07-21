// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// CI util unit tests: run with `node --test e2e/utils/collect-tsio-screenshots.test.js`.

const {describe, it, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

describe('collect-tsio-screenshots', () => {
    /** @type {string} */
    let tmpDir;
    /** @type {(opts?: object) => Promise<{copied: number, skippedMissing: number, outDir: string}>} */
    let collectTsioScreenshots;

    before(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsio-screenshots-'));
        ({collectTsioScreenshots} = await import(
            pathToFileURL(path.join(__dirname, 'collect-tsio-screenshots.mjs')).href
        ));
    });

    after(() => {
        fs.rmSync(tmpDir, {recursive: true, force: true});
    });

    it('copies only image attachments from failed results', async () => {
        const failPng = path.join(tmpDir, 'test-failed-1.png');
        const passPng = path.join(tmpDir, 'should-not-copy.png');
        const userdataPng = path.join(tmpDir, 'userdata', 'icon.png');
        fs.mkdirSync(path.join(tmpDir, 'userdata'), {recursive: true});
        fs.writeFileSync(failPng, 'fail');
        fs.writeFileSync(passPng, 'pass');
        fs.writeFileSync(userdataPng, 'icon');

        const resultsPath = path.join(tmpDir, 'results.json');
        const outDir = path.join(tmpDir, 'out');
        fs.writeFileSync(resultsPath, JSON.stringify({
            suites: [{
                suites: [],
                specs: [{
                    tests: [{
                        results: [
                            {
                                status: 'failed',
                                attachments: [
                                    {name: 'screenshot', path: failPng, contentType: 'image/png'},
                                    {name: 'trace', path: path.join(tmpDir, 'trace.zip'), contentType: 'application/zip'},
                                ],
                            },
                            {
                                status: 'passed',
                                attachments: [
                                    {name: 'screenshot', path: passPng, contentType: 'image/png'},
                                ],
                            },
                        ],
                    }],
                }],
            }],
        }));

        const result = await collectTsioScreenshots({resultsPath, outDir});
        assert.equal(result.copied, 1);
        assert.equal(fs.readdirSync(outDir).length, 1);
        assert.match(fs.readdirSync(outDir)[0], /test-failed-1\.png$/);
        assert.equal(fs.readFileSync(path.join(outDir, fs.readdirSync(outDir)[0]), 'utf8'), 'fail');
    });

    it('writes an empty dir when there are no failures', async () => {
        const resultsPath = path.join(tmpDir, 'passed-results.json');
        const outDir = path.join(tmpDir, 'empty-out');
        fs.writeFileSync(resultsPath, JSON.stringify({
            suites: [{
                specs: [{
                    tests: [{
                        results: [{status: 'passed', attachments: []}],
                    }],
                }],
            }],
        }));

        const result = await collectTsioScreenshots({resultsPath, outDir});
        assert.equal(result.copied, 0);
        assert.deepEqual(fs.readdirSync(outDir), []);
    });
});
