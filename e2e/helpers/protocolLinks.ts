// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

import {getMessageBoxCalls} from './dialog';
import type {ServerView} from './serverView';
import {getShellOpenExternalCalls} from './shell';
import {evaluateInMainProcess, evaluateInMainProcessWithArg} from './testRefs';

export async function waitForDefaultProtocolsAllowed(app: ElectronApplication): Promise<void> {
    await expect.poll(
        () => evaluateInMainProcess(app, () => {
            const protocols = (global as any).__e2eTestRefs?.AllowProtocolDialog?.allowedProtocols ?? [];
            return protocols.includes('https:') && protocols.includes('mailto:');
        }),
        {timeout: 10_000, message: 'AllowProtocolDialog must finish loading default schemes'},
    ).toBe(true);
}

export async function invokeAllowProtocolDialog(app: ElectronApplication, url: string): Promise<void> {
    await evaluateInMainProcessWithArg(app, (_electron, protocolUrl) => {
        const refs = (global as any).__e2eTestRefs;
        if (!refs?.AllowProtocolDialog?.handleDialogEvent) {
            throw new Error('AllowProtocolDialog e2e ref is not available');
        }
        return refs.AllowProtocolDialog.handleDialogEvent(protocolUrl);
    }, url);
}

export async function clickProtocolLink(win: ServerView, href: string): Promise<void> {
    await win.runInRenderer(`
        const href = ${JSON.stringify(href)};
        const id = 'e2e-protocol-link';
        document.getElementById(id)?.remove();
        const anchor = document.createElement('a');
        anchor.id = id;
        anchor.href = href;
        anchor.target = '_blank';
        anchor.rel = 'noreferrer noopener';
        anchor.textContent = href;
        anchor.style.cssText = 'position:fixed;left:8px;top:8px;z-index:2147483647;';
        document.body.appendChild(anchor);
        anchor.click();
        return true;
    `, true);
}

/**
 * Prefer a real link click through WebContentsEventManager. If the view cannot
 * dispatch the custom protocol (error page, CSP), fall back to the same
 * AllowProtocolDialog handler the click path uses.
 */
export async function triggerCustomProtocol(
    app: ElectronApplication,
    win: ServerView,
    url: string,
    options?: {expectDialog?: boolean},
): Promise<void> {
    const expectDialog = options?.expectDialog ?? false;
    const dialogsBefore = (await getMessageBoxCalls(app)).length;
    const opensBefore = (await getShellOpenExternalCalls(app)).length;

    await clickProtocolLink(win, url).catch(() => {});

    try {
        await expect.poll(async () => {
            const dialogs = (await getMessageBoxCalls(app)).length;
            const opens = (await getShellOpenExternalCalls(app)).length;
            return dialogs > dialogsBefore || opens > opensBefore;
        }, {timeout: 2_000}).toBe(true);
    } catch {
        await invokeAllowProtocolDialog(app, url);
    }

    if (expectDialog) {
        await expect.poll(
            async () => (await getMessageBoxCalls(app)).length,
            {timeout: 10_000, message: `Protocol dialog must appear for ${url}`},
        ).toBeGreaterThan(dialogsBefore);
    }
}
