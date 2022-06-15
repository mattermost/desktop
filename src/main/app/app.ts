// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app, BrowserWindow, Event, dialog, WebContents, Certificate} from 'electron';
import log from 'electron-log';

import urlUtils from 'common/utils/url';

import updateManager from 'main/autoUpdater';
import CertificateStore from 'main/certificateStore';
import {destroyTray} from 'main/tray/tray';
import WindowManager from 'main/windows/windowManager';

import {getDeeplinkingURL, openDeepLink, resizeScreen} from './utils';

export const certificateErrorCallbacks = new Map();

//
// app event handlers
//

// activate first app instance, subsequent instances will quit themselves
export function handleAppSecondInstance(event: Event, argv: string[]) {
    log.debug('App.handleAppSecondInstance', argv);

    // Protocol handler for win32
    // argv: An array of the second instance’s (command line / deep linked) arguments
    const deeplinkingUrl = getDeeplinkingURL(argv);
    WindowManager.showMainWindow(deeplinkingUrl);
}

export function handleAppWindowAllClosed() {
    log.debug('App.handleAppWindowAllClosed');

    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
}

export function handleAppBrowserWindowCreated(event: Event, newWindow: BrowserWindow) {
    log.debug('App.handleAppBrowserWindowCreated');

    // Screen cannot be required before app is ready
    resizeScreen(newWindow);
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
    log.debug('App.handleAppBeforeQuit');

    // Make sure tray icon gets removed if the user exits via CTRL-Q
    destroyTray();
    global.willAppQuit = true;
    updateManager.handleOnQuit();
}

export async function handleAppCertificateError(event: Event, webContents: WebContents, url: string, error: string, certificate: Certificate, callback: (isTrusted: boolean) => void) {
    log.verbose('App.handleAppCertificateError', {url, error, certificate});

    const parsedURL = urlUtils.parseURL(url);
    if (!parsedURL) {
        return;
    }
    const origin = parsedURL.origin;
    if (CertificateStore.isExplicitlyUntrusted(origin)) {
        event.preventDefault();
        log.warn(`Ignoring previously untrusted certificate for ${origin}`);
        callback(false);
    } else if (CertificateStore.isTrusted(origin, certificate)) {
        event.preventDefault();
        callback(true);
    } else {
    // update the callback
        const errorID = `${origin}:${error}`;

        // if we are already showing that error, don't add more dialogs
        if (certificateErrorCallbacks.has(errorID)) {
            log.warn(`Ignoring already shown dialog for ${errorID}`);
            certificateErrorCallbacks.set(errorID, callback);
            return;
        }
        const extraDetail = CertificateStore.isExisting(origin) ? 'Certificate is different from previous one.\n\n' : '';
        const detail = `${extraDetail}origin: ${origin}\nError: ${error}`;

        certificateErrorCallbacks.set(errorID, callback);

        // TODO: should we move this to window manager or provide a handler for dialogs?
        const mainWindow = WindowManager.getMainWindow();
        if (!mainWindow) {
            return;
        }

        try {
            let result = await dialog.showMessageBox(mainWindow, {
                title: 'Certificate Error',
                message: 'There is a configuration issue with this Mattermost server, or someone is trying to intercept your connection. You also may need to sign into the Wi-Fi you are connected to using your web browser.',
                type: 'error',
                detail,
                buttons: ['More Details', 'Cancel Connection'],
                cancelId: 1,
            });

            if (result.response === 0) {
                result = await dialog.showMessageBox(mainWindow, {
                    title: 'Certificate Not Trusted',
                    message: `Certificate from "${certificate.issuerName}" is not trusted.`,
                    detail: extraDetail,
                    type: 'error',
                    buttons: ['Trust Insecure Certificate', 'Cancel Connection'],
                    cancelId: 1,
                    checkboxChecked: false,
                    checkboxLabel: "Don't ask again",
                });
            } else {
                result = {response: result.response, checkboxChecked: false};
            }

            if (result.response === 0) {
                CertificateStore.add(origin, certificate);
                CertificateStore.save();
                certificateErrorCallbacks.get(errorID)(true);

                const viewName = WindowManager.getViewNameByWebContentsId(webContents.id);
                if (viewName) {
                    const view = WindowManager.viewManager?.views.get(viewName);
                    view?.load(url);
                } else {
                    webContents.loadURL(url);
                }
            } else {
                if (result.checkboxChecked) {
                    CertificateStore.add(origin, certificate, true);
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

export function handleAppGPUProcessCrashed(event: Event, killed: boolean) {
    log.error(`The GPU process has crashed (killed = ${killed})`);
}
