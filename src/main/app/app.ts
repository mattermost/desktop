// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BrowserWindow, Event, WebContents, Certificate, Details} from 'electron';
import {app, dialog} from 'electron';

import {Logger} from 'common/log';
import {parseURL} from 'common/utils/url';
import updateManager from 'main/autoUpdater';
import CertificateStore from 'main/certificateStore';
import {localizeMessage} from 'main/i18nManager';
import Tray from 'main/tray/tray';
import ViewManager from 'main/views/viewManager';
import MainWindow from 'main/windows/mainWindow';

import {getDeeplinkingURL, openDeepLink, resizeScreen} from './utils';

export const certificateErrorCallbacks = new Map();

const log = new Logger('App.App');

//
// app event handlers
//

// activate first app instance, subsequent instances will quit themselves
export function handleAppSecondInstance(event: Event, argv: string[]) {
    log.debug('handleAppSecondInstance', argv);

    // Protocol handler for win32
    // argv: An array of the second instance’s (command line / deep linked) arguments
    const deeplinkingURL = getDeeplinkingURL(argv);
    if (deeplinkingURL) {
        openDeepLink(deeplinkingURL);
    } else if (MainWindow.get()) {
        MainWindow.show();
    }
}

export function handleAppWindowAllClosed() {
    log.debug('handleAppWindowAllClosed');

    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
}

export function handleAppBrowserWindowCreated(event: Event, newWindow: BrowserWindow) {
    log.debug('handleAppBrowserWindowCreated');

    // Screen cannot be required before app is ready
    if (app.isReady()) {
        resizeScreen(newWindow);
    } else {
        newWindow.once('restore', () => resizeScreen(newWindow));
    }
}

export function handleAppWillFinishLaunching() {
    // Protocol handler for osx
    app.on('open-url', (event, url) => {
        log.info(`Handling deeplinking url: ${url}`);
        event.preventDefault();
        const deeplinkingUrl = getDeeplinkingURL([url]);
        if (deeplinkingUrl) {
            if (app.isReady() && deeplinkingUrl) {
                openDeepLink(deeplinkingUrl);
            } else {
                app.once('ready', () => openDeepLink(deeplinkingUrl));
            }
        }
    });
}

export function handleAppBeforeQuit() {
    log.debug('handleAppBeforeQuit');

    // Make sure tray icon gets removed if the user exits via CTRL-Q
    Tray.destroy();
    global.willAppQuit = true;
    updateManager.handleOnQuit();
}

export async function handleAppCertificateError(event: Event, webContents: WebContents, url: string, error: string, certificate: Certificate, callback: (isTrusted: boolean) => void) {
    log.verbose('handleAppCertificateError', {url, error, certificate});

    const parsedURL = parseURL(url);
    if (!parsedURL) {
        return;
    }
    if (CertificateStore.isExplicitlyUntrusted(parsedURL)) {
        event.preventDefault();
        log.warn(`Ignoring previously untrusted certificate for ${parsedURL.origin}`);
        callback(false);
    } else if (CertificateStore.isTrusted(parsedURL, certificate)) {
        event.preventDefault();
        callback(true);
    } else {
    // update the callback
        const errorID = `${parsedURL.origin}:${error}`;

        const view = ViewManager.getViewByWebContentsId(webContents.id);
        if (view?.view.server) {
            const serverURL = parseURL(view.view.server.url);
            if (serverURL && serverURL.origin !== parsedURL.origin) {
                log.warn(`Ignoring certificate for unmatched origin ${parsedURL.origin}, will not trust`);
                callback(false);
                return;
            }
        }

        // if we are already showing that error, don't add more dialogs
        if (certificateErrorCallbacks.has(errorID)) {
            log.warn(`Ignoring already shown dialog for ${errorID}`);
            certificateErrorCallbacks.set(errorID, callback);
            return;
        }
        const extraDetail = CertificateStore.isExisting(parsedURL) ? localizeMessage('main.app.app.handleAppCertificateError.dialog.extraDetail', 'Certificate is different from previous one.\n\n') : '';
        const detail = localizeMessage('main.app.app.handleAppCertificateError.certError.dialog.detail', '{extraDetail}origin: {origin}\nError: {error}', {extraDetail, origin: parsedURL.origin, error});

        certificateErrorCallbacks.set(errorID, callback);

        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            return;
        }

        try {
            let result = await dialog.showMessageBox(mainWindow, {
                title: localizeMessage('main.app.app.handleAppCertificateError.certError.dialog.title', 'Certificate Error'),
                message: localizeMessage('main.app.app.handleAppCertificateError.certError.dialog.message', 'There is a problem with the security certificate for this server or for embedded content in a message. Please contact your Mattermost admin or IT department to resolve this issue.'),
                type: 'error',
                detail,
                buttons: [
                    localizeMessage('main.app.app.handleAppCertificateError.certError.button.moreDetails', 'More Details'),
                    localizeMessage('main.app.app.handleAppCertificateError.certError.button.cancelConnection', 'Cancel Connection'),
                ],
                cancelId: 1,
            });

            if (result.response === 0) {
                result = await dialog.showMessageBox(mainWindow, {
                    title: localizeMessage('main.app.app.handleAppCertificateError.certNotTrusted.dialog.title', 'Certificate Not Trusted'),
                    message: localizeMessage('main.app.app.handleAppCertificateError.certNotTrusted.dialog.message', 'Certificate from "{issuerName}" is not trusted.', {issuerName: certificate.issuerName}),
                    detail: extraDetail,
                    type: 'error',
                    buttons: [
                        localizeMessage('main.app.app.handleAppCertificateError.certNotTrusted.button.trustInsecureCertificate', 'Trust Insecure Certificate'),
                        localizeMessage('main.app.app.handleAppCertificateError.certNotTrusted.button.cancelConnection', 'Cancel Connection'),
                    ],
                    cancelId: 1,
                    checkboxChecked: false,
                    checkboxLabel: "Don't ask again",
                });
            } else {
                result = {response: result.response, checkboxChecked: false};
            }

            if (result.response === 0) {
                CertificateStore.add(parsedURL, certificate);
                CertificateStore.save();
                certificateErrorCallbacks.get(errorID)(true);

                if (view) {
                    view.load(url);
                } else {
                    webContents.loadURL(url);
                }
            } else {
                if (result.checkboxChecked) {
                    CertificateStore.add(parsedURL, certificate, true);
                    CertificateStore.save();
                }
                certificateErrorCallbacks.get(errorID)(false);
            }
        } catch (dialogError) {
            log.error(`There was an error with the Certificate Error dialog: ${dialogError}`);
        }

        certificateErrorCallbacks.delete(errorID);
    }
}

export function handleChildProcessGone(event: Event, details: Details) {
    log.error('"child-process-gone" The child process has crashed. Details: ', details);
}
