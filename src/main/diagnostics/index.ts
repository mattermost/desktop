// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import log, {ElectronLog, LogLevel} from 'electron-log';
import {DiagnosticsReport} from 'types/diagnostics';

import DiagnosticsStep from './DiagnosticStep';
import loggerHooks from './loggerHooks';

import Step1 from './steps/step1.logLevel';
import Step2 from './steps/step2.internetConnection';

const SORTED_STEPS: DiagnosticsStep[] = [
    Step1,
    Step2,
];

class DiagnosticsModule {
    stepCurrent = 0;
    stepTotal = 0;
    report: DiagnosticsReport = [];
    initialLogLevel: LogLevel = 'info';
    logger: ElectronLog = log.create('diagnostics-logger');

    run = async () => {
        log.debug('Diagnostics.run');
        this.configureLogger();
        this.initializeValues();
        this.sendNotificationDiagnosticsStarted();
        await this.executeSteps();
        this.printReport();
        this.initializeValues(true);
    }

    configureLogger = () => {
        this.logger.hooks.push(...loggerHooks(this.logger));
    }

    initializeValues = (clear = false) => {
        this.logger.debug('Diagnostics.initializeValues');
        this.stepCurrent = 0;
        this.stepTotal = clear ? 0 : this.getStepCount();
        this.report = [];
        this.initialLogLevel = this.logger.transports.console.level || 'info';
    }

    getStepCount = () => {
        const stepsCount = SORTED_STEPS.length;
        this.logger.debug('Diagnostics.getStepCount', {stepsCount});

        return stepsCount;
    }

    executeSteps = async () => {
        this.logger.debug('Diagnostics.executeSteps.Started');
        let index = 0;
        for (const step of SORTED_STEPS) {
            const reportStep = {
                name: step.name,
                step: index,
            };
            if (this.isValidStep(step)) {
                // eslint-disable-next-line no-await-in-loop
                const stepResult = await step.run(this.logger);
                this.report.push({
                    ...stepResult,
                    ...reportStep,
                });
                this.logger.debug('Diagnostics.executeSteps.StepCompleted', {index, name: step.name, retries: step.retries, stepResult});
            } else {
                this.report.push({
                    ...reportStep,
                    succeeded: false,
                    duration: 0,
                });
                this.logger.warn('Diagnostics.executeSteps.UnknownStep', {index, step});
            }
            index++;
        }
        this.logger.debug('Diagnostics.executeSteps.Finished');
    }

    printReport = () => {
        this.logger.debug('Diagnostics.printReport: ', this.report);
        return this.report;
    }

    sendNotificationDiagnosticsStarted = () => {
        this.logger.debug('Diagnostics.sendNotificationDiagnosticsStarted');
    }

    isValidStep = (step: unknown) => {
        return step instanceof DiagnosticsStep;
    }
}

const Diagnostics = new DiagnosticsModule();

export default Diagnostics;
