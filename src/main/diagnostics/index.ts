// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shell} from 'electron';
import log, {ElectronLog} from 'electron-log';
import {DiagnosticsReport} from 'types/diagnostics';

import DiagnosticsStep from './DiagnosticStep';

import Step0 from './steps/step0.logLevel';
import Step1 from './steps/step1.internetConnection';
import Step10 from './steps/step10.crashReports';
import Step11 from './steps/step11.auth';
import Step2 from './steps/step2.configValidation';
import Step3 from './steps/step3.serverConnectivity';
import Step4 from './steps/step4.sessionDataValidation';
import Step5 from './steps/step5.browserWindows';
import Step6 from './steps/step6.permissions';
import Step7 from './steps/step7.performance';
import Step8 from './steps/step8.logHeuristics';
import Step9 from './steps/step9.config';

const SORTED_STEPS: DiagnosticsStep[] = [
    Step0,
    Step1,
    Step2,
    Step3,
    Step4,
    Step5,
    Step6,
    Step7,
    Step8,
    Step9,
    Step10,
    Step11,
];

class DiagnosticsModule {
    stepCurrent = 0;
    stepTotal = 0;
    report: DiagnosticsReport = [];
    logger: ElectronLog = log.create('diagnostics-logger');

    run = async () => {
        if (this.isRunning()) {
            this.logger.warn('Diagnostics is already running');
            return;
        }
        this.logger.debug('Diagnostics run');
        this.initializeValues();
        this.sendNotificationDiagnosticsStarted();
        await this.executeSteps();
        this.printReport();
        this.showLogFile();

        this.initializeValues(true);
    }

    initializeValues = (clear = false) => {
        this.logger.transports.file.level = 'silly';
        this.logger.transports.console.level = 'silly';
        this.logger.debug('Diagnostics initializeValues');
        this.stepCurrent = 0;
        this.stepTotal = clear ? 0 : this.getStepCount();
        this.report = [];
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
                this.addToReport({
                    ...stepResult,
                    ...reportStep,
                    payload: stepResult.payload,
                });
                this.logger.debug('Diagnostics executeSteps StepCompleted', {index, name: step.name, retries: step.retries, stepResult});
            } else {
                this.addToReport({
                    ...reportStep,
                    succeeded: false,
                    duration: 0,
                });
                this.logger.warn('Diagnostics executeSteps UnknownStep', {index, step});
            }
            index++;
            this.stepCurrent = index;
        }
        this.logger.debug('Diagnostics executeSteps Finished');
    }

    printReport = () => {
        this.logger.debug('Diagnostics printReport: ', {report: this.report});
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

    isRunning = () => {
        return this.stepTotal > 0 && this.stepCurrent >= 0;
    }

    private addToReport(data: DiagnosticsReport[number]): void {
        this.report = [
            ...this.report,
            data,
        ];
    }
}

const Diagnostics = new DiagnosticsModule();

export default Diagnostics;
