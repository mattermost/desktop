// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {spawn} from 'child_process';
import fs from 'fs';

import os from 'os';
import path from 'path';

import {app, BrowserWindow, dialog} from 'electron';
import log from 'electron-log';

import {localizeMessage} from 'main/i18nManager';

function createErrorReport(err: Error) {
    // eslint-disable-next-line no-undef
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return `Application: ${app.name} ${app.getVersion()}${__HASH_VERSION__ ? ` [commit: ${__HASH_VERSION__}]` : ''}\n` +
         `Platform: ${os.type()} ${os.release()} ${os.arch()}\n` +
         `${err.stack}`;
}

function openDetachedExternal(url: string) {
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
}

export class CriticalErrorHandler {
    mainWindow?: BrowserWindow;

    setMainWindow(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;
    }

    windowUnresponsiveHandler() {
        if (!this.mainWindow) {
            return;
        }
        dialog.showMessageBox(this.mainWindow, {
            type: 'warning',
            title: app.name,
            message: localizeMessage('main.CriticalErrorHandler.unresponsive.dialog.message', 'The window is no longer responsive.\nDo you wait until the window becomes responsive again?'),
            buttons: [
                localizeMessage('label.no', 'No'),
                localizeMessage('label.yes', 'Yes'),
            ],
            defaultId: 0,
        }).then(({response}) => {
            if (response === 0) {
                log.error('BrowserWindow \'unresponsive\' event has been emitted');
                app.relaunch();
            }
        });
    }

    processUncaughtExceptionHandler(err: Error) {
        const file = path.join(app.getPath('userData'), `uncaughtException-${Date.now()}.txt`);
        const report = createErrorReport(err);
        fs.writeFileSync(file, report.replace(new RegExp('\\n', 'g'), os.EOL));

        if (app.isReady()) {
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
            if (!this.mainWindow?.isVisible) {
                return;
            }
            dialog.showMessageBox(
                this.mainWindow,
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
                    child = openDetachedExternal(file);
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
        } else {
            log.error(`Window wasn't ready to handle the error: ${err}\ntrace: ${err.stack}`);
            throw err;
        }
    }
}

const criticalErrorHandler = new CriticalErrorHandler();
export default criticalErrorHandler;

