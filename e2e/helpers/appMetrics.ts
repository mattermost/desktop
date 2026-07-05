// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

/** Shape returned by Electron `app.getAppMetrics()` (subset used by tests). */
export type AppProcessMetric = {
    pid: number;
    type: string;
    name?: string;
};

export type AppProcessMetricsSummary = {
    metrics: AppProcessMetric[];
    totalCount: number;
    tabCount: number;
    nonTabCount: number;
    types: string[];
    pids: number[];
};

/**
 * Upper bounds for non-Tab processes under the sandboxed E2E launch flags in
 * `e2e/fixtures/index.ts` (`--disable-gpu`, `--no-zygote`, etc.). These differ
 * from a normal Task Manager baseline on an end-user install.
 */
const NON_TAB_PROCESS_MAX: Partial<Record<NodeJS.Platform, number>> = {
    darwin: 10,
    linux: 10,
    win32: 12,
};

/** Tab/renderer processes for demoConfig (2 servers + main chrome). */
const TAB_PROCESS_MAX = 30;

export async function getAppProcessMetrics(app: ElectronApplication): Promise<AppProcessMetric[]> {
    return app.evaluate(({app: electronApp}) => {
        return electronApp.getAppMetrics().map((metric) => ({
            pid: metric.pid,
            type: metric.type,
            name: metric.name,
        }));
    });
}

export function summarizeAppProcessMetrics(metrics: AppProcessMetric[]): AppProcessMetricsSummary {
    const tabMetrics = metrics.filter((metric) => metric.type === 'Tab');
    const nonTabMetrics = metrics.filter((metric) => metric.type !== 'Tab');

    return {
        metrics,
        totalCount: metrics.length,
        tabCount: tabMetrics.length,
        nonTabCount: nonTabMetrics.length,
        types: [...new Set(metrics.map((metric) => metric.type))].sort(),
        pids: metrics.map((metric) => metric.pid),
    };
}

export function getNonTabProcessMax(): number {
    return NON_TAB_PROCESS_MAX[process.platform] ?? 12;
}

export function getTabProcessMax(): number {
    return TAB_PROCESS_MAX;
}

export async function summarizeProcessMetrics(app: ElectronApplication): Promise<AppProcessMetricsSummary> {
    const metrics = await getAppProcessMetrics(app);
    return summarizeAppProcessMetrics(metrics);
}
