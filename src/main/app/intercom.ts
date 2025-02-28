// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent, IpcMainInvokeEvent} from 'electron';
import {app, Menu} from 'electron';

import ServerViewState from 'app/serverViewState';
import {ModalConstants} from 'common/constants';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import {ping} from 'common/utils/requests';
import {parseURL} from 'common/utils/url';
import NotificationManager from 'main/notifications';
import {getLocalPreload} from 'main/utils';
import ModalManager from 'main/views/modalManager';
import MainWindow from 'main/windows/mainWindow';

import type {UniqueServer} from 'types/config';

import {handleAppBeforeQuit} from './app';

const log = new Logger('App.Intercom');

export function handleAppVersion() {
    return {
        name: app.getName(),
        version: app.getVersion(),
    };
}

export function handleQuit(e: IpcMainEvent, reason: string, stack: string) {
    log.error(`Exiting App. Reason: ${reason}`);
    log.info(`Stacktrace:\n${stack}`);
    handleAppBeforeQuit();
    app.quit();
}

function handleShowOnboardingScreens(showWelcomeScreen: boolean, showNewServerModal: boolean, mainWindowIsVisible: boolean) {
    log.debug('handleShowOnboardingScreens', {showWelcomeScreen, showNewServerModal, mainWindowIsVisible});

    if (showWelcomeScreen) {
        const welcomeScreen = ModalManager.modalQueue.find((modal) => modal.key === 'welcomeScreen');
        if (welcomeScreen) {
            return;
        }

        handleWelcomeScreenModal();

        if (process.env.NODE_ENV === 'test') {
            const welcomeScreenTest = ModalManager.modalQueue.find((modal) => modal.key === 'welcomeScreen');
            if (welcomeScreenTest?.view.webContents.isLoading()) {
                welcomeScreenTest?.view.webContents.once('did-finish-load', () => {
                    app.emit('e2e-app-loaded');
                });
            } else {
                app.emit('e2e-app-loaded');
            }
        }

        return;
    }
    if (showNewServerModal) {
        ServerViewState.showNewServerModal();
    }
}

export function handleMainWindowIsShown() {
    // eslint-disable-next-line no-undef
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const showWelcomeScreen = () => !(Boolean(__SKIP_ONBOARDING_SCREENS__) || ServerManager.hasServers());
    const showNewServerModal = () => !ServerManager.hasServers();

    /**
     * The 2 lines above need to be functions, otherwise the mainWindow.once() callback from previous
     * calls of this function will notification re-evaluate the booleans passed to "handleShowOnboardingScreens".
    */

    const mainWindow = MainWindow.get();

    log.debug('handleMainWindowIsShown', {showWelcomeScreen, showNewServerModal, mainWindow: Boolean(mainWindow)});
    if (mainWindow?.isVisible()) {
        handleShowOnboardingScreens(showWelcomeScreen(), showNewServerModal(), true);
    } else {
        mainWindow?.once('show', () => {
            handleShowOnboardingScreens(showWelcomeScreen(), showNewServerModal(), false);
        });
    }
}

export function handleWelcomeScreenModal(prefillURL?: string) {
    log.debug('handleWelcomeScreenModal');

    const html = 'mattermost-desktop://renderer/welcomeScreen.html';

    const preload = getLocalPreload('internalAPI.js');

    const mainWindow = MainWindow.get();
    if (!mainWindow) {
        return;
    }
    const modalPromise = ModalManager.addModal<{prefillURL?: string}, UniqueServer>(ModalConstants.WELCOME_SCREEN_MODAL, html, preload, {prefillURL}, mainWindow, !ServerManager.hasServers());
    if (modalPromise) {
        modalPromise.then((data) => {
            let initialLoadURL;
            if (prefillURL) {
                const parsedServerURL = parseURL(data.url);
                if (parsedServerURL) {
                    initialLoadURL = parseURL(`${parsedServerURL.origin}${prefillURL.substring(prefillURL.indexOf('/'))}`);
                }
            }
            const newServer = ServerManager.addServer(data, initialLoadURL);
            ServerViewState.switchServer(newServer.id, true);
        }).catch((e) => {
            // e is undefined for user cancellation
            if (e) {
                log.error(`there was an error in the welcome screen modal: ${e}`);
            }
        });
    } else {
        log.warn('There is already a welcome screen modal');
    }
}

export function handleMentionNotification(event: IpcMainInvokeEvent, title: string, body: string, channelId: string, teamId: string, url: string, silent: boolean, soundName: string) {
    log.debug('handleMentionNotification', {channelId, teamId, url, silent, soundName});
    return NotificationManager.displayMention(title, body, channelId, teamId, url, silent, event.sender, soundName);
}

export function handleOpenAppMenu() {
    log.debug('handleOpenAppMenu');

    const windowMenu = Menu.getApplicationMenu();
    if (!windowMenu) {
        log.error('No application menu found');
        return;
    }
    windowMenu.popup({
        window: MainWindow.get(),
        x: 18,
        y: 18,
    });
}

export function handlePingDomain(event: IpcMainInvokeEvent, url: string): Promise<string> {
    return Promise.allSettled([
        ping(new URL(`https://${url}`)),
        ping(new URL(`http://${url}`)),
    ]).then(([https, http]): string => {
        if (https.status === 'fulfilled') {
            return 'https';
        } else if (http.status === 'fulfilled') {
            return 'http';
        }
        throw new Error('Could not find server ' + url);
    });
}

export function handleToggleSecureInput(event: IpcMainEvent, secureInput: boolean) {
    if (process.platform !== 'darwin') {
        return;
    }

    // Don't allow this to turn on if the main window isn't focused
    if (secureInput && !MainWindow.get()?.isFocused()) {
        return;
    }

    // Enforce macOS to restrict processes from reading the keyboard input when in a password field
    log.debug('handleToggleSecureInput', secureInput);
    app.setSecureKeyboardEntryEnabled(secureInput);
}

export function handleShowSettingsModal() {
    const mainWindow = MainWindow.get();
    if (!mainWindow) {
        return;
    }

    ModalManager.addModal(
        ModalConstants.SETTINGS_MODAL,
        'mattermost-desktop://renderer/settings.html',
        getLocalPreload('internalAPI.js'),
        null,
        mainWindow,
    );
}
