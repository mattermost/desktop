// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {
    getNonTabProcessMax,
    getTabProcessMax,
    summarizeProcessMetrics,
} from '../../helpers/appMetrics';

// ── MM-T4022: Task Manager process count ───────────────────────────────
// Uses `app.getAppMetrics()` instead of OS Task Manager. Counts are calibrated
// for the sandboxed Playwright launch (--disable-gpu, --no-zygote, etc.), not
// a production install baseline.

test.describe('startup/process_metrics', () => {
    test(
        'MM-T4022 app process metrics stay within expected bounds after launch',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            const serverViewCount = Object.values(serverMap).reduce(
                (count, entries) => count + entries.length,
                0,
            );
            expect(serverViewCount, 'demoConfig must register server views').toBeGreaterThanOrEqual(2);

            await expect.poll(
                async () => (await summarizeProcessMetrics(electronApp)).totalCount,
                {timeout: 30_000, message: 'Electron must report at least one process metric'},
            ).toBeGreaterThan(0);

            const summary = await summarizeProcessMetrics(electronApp);

            expect(summary.types, 'Main Browser process must be present').toContain('Browser');
            expect(summary.nonTabCount, 'Non-renderer process count must be positive').toBeGreaterThanOrEqual(1);
            expect(
                summary.nonTabCount,
                'Non-renderer count must match E2E sandbox launch expectations',
            ).toBeLessThanOrEqual(getNonTabProcessMax());

            expect(
                summary.tabCount,
                'Tab processes must cover configured server WebContentsViews',
            ).toBeGreaterThanOrEqual(serverViewCount);
            expect(summary.tabCount, 'Tab process count must not grow unbounded').toBeLessThanOrEqual(getTabProcessMax());

            const uniquePids = new Set(summary.pids);
            expect(uniquePids.size, 'Each process metric entry must map to a unique pid').toBe(summary.pids.length);

            const firstNonTabCount = summary.nonTabCount;
            await expect.poll(
                async () => (await summarizeProcessMetrics(electronApp)).nonTabCount,
                {timeout: 10_000, message: 'Non-renderer process count must stabilize after launch'},
            ).toBe(firstNonTabCount);
        },
    );
});
