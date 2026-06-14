// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

export function mattermostDeepLinkUrl(hostAndPath: string): string {
    const protocol = process.env.NODE_ENV === 'test' ? 'mattermost-dev' : 'mattermost';
    return `${protocol}://${hostAndPath}`;
}

export async function openDeepLinkInApp(app: ElectronApplication, url: string): Promise<void> {
    await app.evaluate((_, deepLinkUrl) => {
        const openDeepLink = (global as any).__e2eOpenDeepLink as ((value: string) => void) | undefined;
        if (!openDeepLink) {
            throw new Error('__e2eOpenDeepLink not exposed (NODE_ENV must be test)');
        }
        openDeepLink(deepLinkUrl);
    }, url);
}
