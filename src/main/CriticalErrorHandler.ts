// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {spawn} from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {app, dialog} from 'electron';

import {Logger} from 'common/log';
import {localizeMessage} from 'main/i18nManager';

const log = new Logger('CriticalErrorHandler');

export class CriticalErrorHandler {
    init = () => {
        process.on('unhandledRejection', this.processUncaughtExceptionHandler);
        process.on('uncaughtException', this.processUncaughtExceptionHandler);
    };

    private processUncaughtExceptionHandler = (err: Error) => {
        if (process.env.NODE_ENV === 'test') {
            return;
        }

        if (app.isReady()) {
            this.showExceptionDialog(err);
        } else {
            app.once('ready', () => {
                this.showExceptionDialog(err);
            });
        }
    };

    private showExceptionDialog = (err: Error) => {
        const file = path.join(app.getPath('userData'), `uncaughtException-${Date.now()}.txt`);
        const report = this.createErrorReport(err);
        fs.writeFileSync(file, report.replace(new RegExp('\\n', 'g'), os.EOL));

        const buttons = [
            localizeMessage('main.CriticalErrorHandler.uncaughtException.button.showDetails', 'Show Details'),
            localizeMessage('label.ok', 'OK'),
            localizeMessage('main.CriticalErrorHandler.uncaughtException.button.reopen', 'Reopen'),
        ];
        let indexOfReopen = 2;
        let indexOfShowDetails = 0;
        if (process.platform === 'darwin') {
            buttons.reverse();
            indexOfReopen = 0;
            indexOfShowDetails = 2;
        }
        dialog.showMessageBox(
            {
                type: 'error',
                title: app.name,
                message: localizeMessage(
                    'main.CriticalErrorHandler.uncaughtException.dialog.message',
                    'The {appName} app quit unexpectedly. Click "{showDetails}" to learn more or "{reopen}" to open the application again.\n\nInternal error: {err}',
                    {
                        appName: app.name,
                        showDetails: localizeMessage('main.CriticalErrorHandler.uncaughtException.button.showDetails', 'Show Details'),
                        reopen: localizeMessage('main.CriticalErrorHandler.uncaughtException.button.reopen', 'Reopen'),
                        err: err.message,
                    },
                ),
                buttons,
                defaultId: indexOfReopen,
                noLink: true,
            },
        ).then(({response}) => {
            let child;
            switch (response) {
            case indexOfShowDetails:
                child = this.openDetachedExternal(file);
                if (child) {
                    child.on(
                        'error',
                        (spawnError) => {
                            log.error(spawnError);
                        },
                    );
                    child.unref();
                }
                break;
            case indexOfReopen:
                app.relaunch();
                break;
            }
            app.exit(-1);
        });
    };

    private openDetachedExternal = (url: string) => {
        const spawnOption = {detached: true, stdio: 'ignore' as const};
        switch (process.platform) {
        case 'win32':
            return spawn('cmd', ['/C', 'start', url], spawnOption);
        case 'darwin':
            return spawn('open', [url], spawnOption);
        case 'linux':
            return spawn('xdg-open', [url], spawnOption);
        default:
            return undefined;
        }
    };

    private createErrorReport = (err: Error) => {
        // eslint-disable-next-line no-undef
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return `Application: ${app.name} ${app.getVersion()}${__HASH_VERSION__ ? ` [commit: ${__HASH_VERSION__}]` : ''}\n` +
             `Platform: ${os.type()} ${os.release()} ${os.arch()}\n` +
             `${err.stack}`;
    };
}

const criticalErrorHandler = new CriticalErrorHandler();
export default criticalErrorHandler;

