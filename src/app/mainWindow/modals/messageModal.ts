// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app} from 'electron';
import {v4 as uuid} from 'uuid';

import MainWindow from 'app/mainWindow/mainWindow';
import ModalManager from 'app/mainWindow/modals/modalManager';
import {MAIN_WINDOW_MINIMIZE_TO_TRAY, MAIN_WINDOW_CLOSE_CONFIRM} from 'common/communication';
import Config from 'common/config';
import {ModalConstants} from 'common/constants';
import {localizeMessage} from 'main/i18nManager';
import {getLocalPreload} from 'main/utils';

import type {MessageModalInfo, MessageModalOpts, MessageModalResult} from 'types/modals';

const messageModalHtml = 'mattermost-desktop://renderer/message.html';
const closeConfirmKey = `${ModalConstants.MESSAGE_MODAL}-closeApp`;

export class MessageModal {
    constructor() {
        MainWindow.on(MAIN_WINDOW_MINIMIZE_TO_TRAY, this.handleMinimizeToTray);
        MainWindow.on(MAIN_WINDOW_CLOSE_CONFIRM, this.handleCloseConfirm);
    }

    showMessageModal = (options: MessageModalInfo, opts: MessageModalOpts = {}): Promise<MessageModalResult> => {
        const {priority = false, key = `${ModalConstants.MESSAGE_MODAL}-${uuid()}`, serverId} = opts;
        const mainWindow = MainWindow.get();
        const fallback = {response: options.cancelId ?? 0, checkboxChecked: Boolean(options.checkboxChecked)};
        if (!mainWindow) {
            return Promise.resolve(fallback);
        }

        const addModal = priority ? ModalManager.addPriorityModal : ModalManager.addModal;
        const modalPromise = addModal<MessageModalInfo, MessageModalResult>(
            key,
            messageModalHtml,
            getLocalPreload('internalAPI.js'),
            options,
            mainWindow,
            false,
            serverId,
        );
        return modalPromise.catch(() => fallback);
    };

    showErrorModal = (title: string, message: string): void => {
        this.showMessageModal({type: 'error', title, message});
    };

    private handleMinimizeToTray = () => {
        this.showMessageModal({
            title: localizeMessage('main.windows.mainWindow.minimizeToTray.dialog.title', 'Minimize to Tray'),
            message: localizeMessage('main.windows.mainWindow.minimizeToTray.dialog.message', '{appName} will continue to run in the system tray. This can be disabled in Settings.', {appName: app.name}),
            type: 'info',
            checkboxChecked: true,
            checkboxLabel: localizeMessage('main.windows.mainWindow.minimizeToTray.dialog.checkboxLabel', 'Don\'t show again'),
        }).then((result) => {
            Config.set('alwaysMinimize', result.checkboxChecked);
            const mainWindow = MainWindow.get();
            mainWindow?.blur(); // To move focus to the next top-level window in Windows
            mainWindow?.hide();
        });
    };

    isCloseConfirmOpen = () => {
        return ModalManager.modalQueue.some((modal) => modal.key === closeConfirmKey);
    };

    private handleCloseConfirm = () => {
        if (this.isCloseConfirmOpen()) {
            return;
        }

        this.showMessageModal({
            title: localizeMessage('main.windows.mainWindow.closeApp.dialog.title', 'Close Application'),
            message: localizeMessage('main.windows.mainWindow.closeApp.dialog.message', 'Are you sure you want to quit?'),
            detail: localizeMessage('main.windows.mainWindow.closeApp.dialog.detail', 'You will no longer receive notifications for messages. If you want to leave {appName} running in the system tray, you can enable this in Settings.', {appName: app.name}),
            type: 'question',
            buttons: [
                localizeMessage('label.yes', 'Yes'),
                localizeMessage('label.no', 'No'),
            ],
            defaultId: 0,
            cancelId: 1,
            checkboxChecked: true,
            checkboxLabel: localizeMessage('main.windows.mainWindow.closeApp.dialog.checkboxLabel', 'Don\'t ask again'),
        }, {priority: true, key: closeConfirmKey}).then((result) => {
            Config.set('alwaysClose', result.checkboxChecked && result.response === 0);
            if (result.response === 0) {
                app.quit();
            }
        });
    };
}

const messageModal = new MessageModal();
export default messageModal;
