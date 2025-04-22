// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app, ipcMain, type IpcMainEvent, powerMonitor, type WebContents} from 'electron';

import {EMIT_CONFIGURATION, METRICS_RECEIVE, METRICS_REQUEST, METRICS_SEND} from 'common/communication';
import Config from 'common/config';
import {Logger} from 'common/log';

const METRIC_SEND_INTERVAL = 60000;
const log = new Logger('PerformanceMonitor');

type MetricsView = {
    name: string;
    webContents: WebContents;
    serverId?: string;
}

type Metrics = {
    serverId?: string;
    cpu?: number;
    memory?: number;
}

export class PerformanceMonitor {
    private updateInterval?: NodeJS.Timeout;
    private views: Map<number, MetricsView>;
    private serverViews: Map<number, MetricsView>;
    private isInitted: boolean;

    constructor() {
        this.views = new Map();
        this.serverViews = new Map();
        this.isInitted = false;

        powerMonitor.on('suspend', this.stop);
        powerMonitor.on('resume', this.start);
        powerMonitor.on('lock-screen', this.stop);
        powerMonitor.on('unlock-screen', this.start);
        powerMonitor.on('speed-limit-change', this.handleSpeedLimitChange);

        ipcMain.on(EMIT_CONFIGURATION, this.handleConfigUpdate);
    }

    init = () => {
        // Set that it's initted so that the powerMonitor functions correctly
        this.isInitted = true;

        // Run once because the first CPU value is always 0
        this.runMetrics();

        if (Config.enableMetrics) {
            this.start();
        }
    };

    registerView = (name: string, webContents: WebContents, serverId?: string) => {
        log.debug('registerView', webContents.id, name);

        webContents.on('did-finish-load', () => {
            this.views.set(webContents.id, {name, webContents, serverId});
        });
    };

    registerServerView = (name: string, webContents: WebContents, serverId: string) => {
        log.debug('registerServerView', webContents.id, serverId);

        webContents.on('did-finish-load', () => {
            this.serverViews.set(webContents.id, {name, webContents, serverId});
        });
    };

    unregisterView = (webContentsId: number) => {
        log.debug('unregisterView', webContentsId);

        this.views.delete(webContentsId);
        this.serverViews.delete(webContentsId);
    };

    private start = () => {
        if (!this.isInitted) {
            return;
        }

        if (!Config.enableMetrics) {
            return;
        }

        log.verbose('start');

        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.updateInterval = setInterval(this.sendMetrics, METRIC_SEND_INTERVAL);
    };

    private stop = () => {
        log.verbose('stop');

        clearInterval(this.updateInterval);
        delete this.updateInterval;
    };

    private runMetrics = async () => {
        const metricsMap: Map<string, Metrics> = new Map();

        // Collect metrics for all of the Node processes
        app.getAppMetrics().
            filter((metric) => metric.type !== 'Tab').
            forEach((metric) => {
                metricsMap.set(metric.name ?? metric.type, {
                    cpu: metric.cpu.percentCPUUsage,
                    memory: metric.memory.privateBytes ?? metric.memory.workingSetSize,
                });
            });

        const viewResolves: Map<number, () => void> = new Map();
        const listener = (event: IpcMainEvent, name: string, metrics: Metrics) => {
            metricsMap.set(name, metrics);
            viewResolves.get(event.sender.id)?.();
        };
        ipcMain.on(METRICS_RECEIVE, listener);
        const viewPromises = [...this.views.values(), ...this.serverViews.values()].map((view) => {
            return new Promise<void>((resolve) => {
                viewResolves.set(view.webContents.id, resolve);
                view.webContents.send(METRICS_REQUEST, view.name, view.serverId);
            });
        });

        // After 5 seconds, if all the promises are not resolved, resolve them so we don't block the send
        // This can happen if a view doesn't send back metrics information
        setTimeout(() => {
            [...viewResolves.values()].forEach((value) => value());
        }, 5000);
        await Promise.allSettled(viewPromises);
        ipcMain.off(METRICS_RECEIVE, listener);
        return metricsMap;
    };

    private sendMetrics = async () => {
        const metricsMap = await this.runMetrics();
        for (const view of this.serverViews.values()) {
            const serverId = view.serverId;
            if (!serverId) {
                log.error(`Cannot send metrics for ${view.name}  - missing server id`);
                continue;
            }

            if (!view.webContents) {
                log.error(`Cannot send metrics for ${view.name}  - missing web contents`);
                continue;
            }

            const serverMetricsMap = new Map([...metricsMap].filter((value) => !value[1].serverId || value[1].serverId === view.serverId));
            view.webContents.send(METRICS_SEND, serverMetricsMap);
        }
    };

    private handleConfigUpdate = () => {
        if (!Config.enableMetrics && this.updateInterval) {
            this.stop();
        } else if (!this.updateInterval) {
            this.start();
        }
    };

    private handleSpeedLimitChange = (details: {limit: number}) => {
        if (details.limit < 100) {
            this.stop();
        } else {
            this.start();
        }
    };
}

const performanceMonitor = new PerformanceMonitor();
export default performanceMonitor;
