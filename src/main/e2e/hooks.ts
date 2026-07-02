// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {setTestField} from 'common/utils/util';

type MessageBoxResponse = {response: number};

type SimulateNotificationClickPayload = {
    webContentsId: number;
    channelId: string;
    teamId: string;
    url: string;
};

type RegisterE2eHooksOptions = {
    e2eTestRefs: Record<string, unknown>;
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
