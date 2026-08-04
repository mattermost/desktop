// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {setTestField} from 'common/utils/util';

import type {SimulateNotificationClickPayload} from './notificationClick';

type MessageBoxResponse = {response: number};

/**
 * Shape of `global.__e2eTestRefs`, set by registerE2eHooks() below. Kept in sync
 * manually with the object built in `register.ts` — there's no way to derive this
 * from the call site without a circular type dependency.
 */
export type E2eGlobalRefs = {
    AppState: typeof import('common/appState').default;
    MainWindow: typeof import('app/mainWindow/mainWindow').default;
    NotificationManager: typeof import('main/notifications').default;
    ServerManager: typeof import('common/servers/serverManager').default;
    TabManager: typeof import('app/tabs/tabManager').default;
    ViewManager: typeof import('common/views/viewManager').default;
    WebContentsManager: typeof import('app/views/webContentsManager').default;
    Config: typeof import('common/config').default;
    TrayIcon: typeof import('app/system/tray/tray').default;
    Diagnostics: typeof import('main/diagnostics').default;
    PopoutManager: typeof import('app/windows/popoutManager').default;
    updateNotifier: typeof import('main/updateNotifier').default;
    setUnreadBadgeSetting: (showUnreadBadge: boolean) => void;
};

type RegisterE2eHooksOptions = {
    e2eTestRefs: E2eGlobalRefs;
    openDeepLink: (url: string) => void;
    clickTrayMenuItem: (label: string) => void;
    triggerNotificationFrameEffects: (flash: boolean) => void;
    simulateNotificationClick: (payload: SimulateNotificationClickPayload) => void;
    installMessageBoxStub: (responses: MessageBoxResponse[]) => void;
    restoreMessageBoxStub: () => void;
    clearCertificateErrorCallbacks: () => void;
};

/**
 * Register Playwright/Detox globals on `global` for E2E. Each assignment is a
 * no-op in production because setTestField() gates on NODE_ENV === 'test'.
 */
export function registerE2eHooks(options: RegisterE2eHooksOptions): void {
    setTestField('__e2eTestRefs', options.e2eTestRefs);
    setTestField('__e2eOpenDeepLink', options.openDeepLink);
    setTestField('__e2eClickTrayMenuItem', options.clickTrayMenuItem);
    setTestField('__e2eNotificationEffects', options.triggerNotificationFrameEffects);
    setTestField('__e2eSimulateNotificationClick', options.simulateNotificationClick);
    setTestField('__e2eStubMessageBoxResponses', options.installMessageBoxStub);
    setTestField('__e2eRestoreMessageBox', options.restoreMessageBoxStub);
    setTestField('__e2eClearCertificateErrorCallbacks', options.clearCertificateErrorCallbacks);
}
