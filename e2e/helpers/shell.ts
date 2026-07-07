// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

export async function stubShellOpenExternal(app: ElectronApplication): Promise<void> {
    await app.evaluate(({shell}) => {
        (shell as any).__e2eOpenExternalCalls = [];
        (shell as any).__e2eOriginalOpenExternal = shell.openExternal.bind(shell);
        shell.openExternal = async (url: string) => {
            (shell as any).__e2eOpenExternalCalls.push(url);
        };
    });
}

export async function restoreShellOpenExternal(app: ElectronApplication): Promise<void> {
    try {
        await app.evaluate(({shell}) => {
            const original = (shell as any).__e2eOriginalOpenExternal;
            if (original) {
                shell.openExternal = original;
            }
            delete (shell as any).__e2eOpenExternalCalls;
            delete (shell as any).__e2eOriginalOpenExternal;
        });
    } catch {
        // App may already be closed after quit-style tests.
    }
}

export async function getShellOpenExternalCalls(app: ElectronApplication): Promise<string[]> {
    return app.evaluate(({shell}) => (shell as any).__e2eOpenExternalCalls ?? []);
}
