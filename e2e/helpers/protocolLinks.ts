// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {expect} from '../fixtures/index';

import {isMessageModalOpen} from './dialog';
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

/**
 * Direct AllowProtocolDialog.handleDialogEvent invocation. Use only when a spec
 * cannot exercise renderer / WebContentsEventManager protocol dispatch.
 */
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
 * Dispatch a custom protocol through WebContentsEventManager via a real link click.
 * Click failures propagate so a broken renderer path fails the spec. When a trust
 * modal is expected, the caller must answer it via answerMessageModal; the protocol
 * handler stays pending until then.
 */
export async function triggerCustomProtocol(
    app: ElectronApplication,
    win: ServerView,
    url: string,
    options?: {expectDialog?: boolean},
): Promise<void> {
    const expectDialog = options?.expectDialog ?? false;
    const opensBefore = (await getShellOpenExternalCalls(app)).length;

    await clickProtocolLink(win, url);

    if (expectDialog) {
        await expect.poll(
            () => isMessageModalOpen(app),
            {timeout: 10_000, message: `Protocol trust modal must appear for ${url}`},
        ).toBe(true);
    } else {
        await expect.poll(
            async () => (await getShellOpenExternalCalls(app)).length,
            {timeout: 10_000, message: `${url} must open without a trust modal`},
        ).toBeGreaterThan(opensBefore);
        expect(isMessageModalOpen(app)).toBe(false);
    }
}
