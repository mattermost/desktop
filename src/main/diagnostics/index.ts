// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import log, {LogLevel} from 'electron-log';
import {DiagnosticsReport} from 'types/diagnostics';

import DiagnosticsStep from './DiagnosticStep';
import Step1 from './steps/step1.logLevel';

const SORTED_STEPS: DiagnosticsStep[] = [
    Step1,
];

class DiagnosticsModule {
    stepCurrent = 0;
    stepTotal = 0;
    report: DiagnosticsReport = [];
    initialLogLevel: LogLevel = 'info';

    run = () => {
        log.debug('Diagnostics.run');
        this.initializeValues();
        this.sendNotificationDiagnosticsStarted();
        this.executeSteps();
        this.printReport();
        this.initializeValues();
    }

    initializeValues = () => {
        log.debug('Diagnostics.initializeValues');
        this.stepCurrent = 0;
        this.stepTotal = this.getStepCount();
        this.report = [];
        this.initialLogLevel = log.transports.console.level || 'info';
    }

    getStepCount = () => {
        const stepsCount = SORTED_STEPS.length;
        log.debug('Diagnostics.getStepCount', {stepsCount});

        return stepsCount;
    }

    executeSteps = async () => {
        log.debug('Diagnostics.executeSteps.Started');
        let index = 0;
        for (const step of SORTED_STEPS) {
            const reportStep = {
                name: step.name,
                step: index,
            };
            if (this.isValidStep(step)) {
                // eslint-disable-next-line no-await-in-loop
                const stepResult = await step.run();
                this.report.push({
                    ...stepResult,
                    ...reportStep,
                });
                log.debug('Diagnostics.executeSteps.StepCompleted', {index, step, stepResult});
            } else {
                this.report.push({
                    ...reportStep,
                    succeeded: false,
                    duration: 0,
                });
                log.warn('Diagnostics.executeSteps.UnknownStep', {index, step});
            }
            index++;
        }
        log.debug('Diagnostics.executeSteps.Finished');
    }

    printReport = () => {
        log.debug('Diagnostics.printReport: ', this.report);
        return this.report;
    }

    sendNotificationDiagnosticsStarted = () => {
        log.debug('Diagnostics.sendNotificationDiagnosticsStarted');
    }

    isValidStep = (step: unknown) => {
        return step instanceof DiagnosticsStep;
    }
}

const Diagnostics = new DiagnosticsModule();

export default Diagnostics;
