// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shell} from 'electron';
import log, {ElectronLog, LogLevel} from 'electron-log';
import {DiagnosticsReport} from 'types/diagnostics';

import DiagnosticsStep from './DiagnosticStep';

import Step0 from './steps/step0.logLevel';
import Step1 from './steps/step1.internetConnection';
import Step2 from './steps/step2.configValidation';

const SORTED_STEPS: DiagnosticsStep[] = [
    Step0,
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
        this.logger.debug('Diagnostics run');
        this.initializeValues();
        this.sendNotificationDiagnosticsStarted();
        await this.executeSteps();
        this.printReport();
        this.showLogFile();

        this.initializeValues(true);
    }

    initializeValues = (clear = false) => {
        this.logger.debug('Diagnostics initializeValues');
        this.stepCurrent = 0;
        this.stepTotal = clear ? 0 : this.getStepCount();
        this.report = [];
        this.initialLogLevel = this.logger.transports.console.level || 'info';
    }

    getStepCount = () => {
        const stepsCount = SORTED_STEPS.length;
        this.logger.debug('Diagnostics getStepCount', {stepsCount});

        return stepsCount;
    }

    executeSteps = async () => {
        this.logger.debug('Diagnostics executeSteps Started');
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
                    payload: JSON.stringify(stepResult.payload, null, 4),
                });
                this.logger.debug('Diagnostics executeSteps StepCompleted', {index, name: step.name, retries: step.retries, stepResult});
            } else {
                this.report.push({
                    ...reportStep,
                    succeeded: false,
                    duration: 0,
                });
                this.logger.warn('Diagnostics executeSteps UnknownStep', {index, step});
            }
            index++;
        }
        this.logger.debug('Diagnostics executeSteps Finished');
    }

    printReport = () => {
        this.logger.debug('Diagnostics printReport: ', this.report);
        return this.report;
    }

    showLogFile = () => {
        const pathToFile = this.getLoggerFilePath();
        this.logger.debug('Diagnostics showLogFile', {pathToFile});
        shell.showItemInFolder(pathToFile);
    }

    sendNotificationDiagnosticsStarted = () => {
        this.logger.debug('Diagnostics sendNotification DiagnosticsStarted');
    }

    isValidStep = (step: unknown) => {
        return step instanceof DiagnosticsStep;
    }

    getLoggerFilePath = () => {
        return this.logger.transports.file.getFile()?.path;
    }
}

const Diagnostics = new DiagnosticsModule();

export default Diagnostics;
