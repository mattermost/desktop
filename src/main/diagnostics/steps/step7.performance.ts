// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import path from 'path';

import {app, powerMonitor} from 'electron';
import type {MainLogger} from 'electron-log';

import type {DiagnosticStepResponse} from 'types/diagnostics';

import {dateTimeInFilename} from './internal/utils';

import DiagnosticsStep from '../DiagnosticStep';

const stepName = 'Step-7';
const stepDescriptiveName = 'PerformanceAndMemory';

const run = async (logger: MainLogger): Promise<DiagnosticStepResponse> => {
    try {
        const heapSnapshotFilepath = path.join(app.getAppPath(), `heapSnapshots/heap_snap_${dateTimeInFilename()}.txt`);

        const payload: Record<string, unknown> = {
            process: {
                creationTime: process.getCreationTime(),
                heapStatistics: process.getHeapStatistics(),
                blinkMemory: process.getBlinkMemoryInfo(),
                processMemory: process.getProcessMemoryInfo(),
                systemMemory: process.getSystemMemoryInfo(),
                systemVersion: process.getSystemVersion(),
                cpuUsage: process.getCPUUsage(),
                heapSnapshot: {
                    path: heapSnapshotFilepath,
                    success: process.takeHeapSnapshot(heapSnapshotFilepath),
                },
                uptime: process.uptime(),
                platform: process.platform,
                sandboxed: process.sandboxed,
                contextIsolated: process.contextIsolated,
                type: process.type,
                versions: process.versions,
                version: process.version,
                mas: process.mas,
                windowsStore: process.windowsStore,
            },
            onBattery: powerMonitor.onBatteryPower,
        };

        return {
            message: `${stepName} finished successfully`,
            succeeded: true,
            payload,
        };
    } catch (error) {
        logger.warn(`Diagnostics ${stepName} Failure`, {error});
        return {
            message: `${stepName} failed`,
            succeeded: false,
            payload: error,
        };
    }
};

const Step7 = new DiagnosticsStep({
    name: `diagnostic-${stepName}: ${stepDescriptiveName}`,
    retries: 0,
    run,
});

export default Step7;
