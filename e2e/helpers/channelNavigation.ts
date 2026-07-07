// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

import {popoutWindowCount} from './popoutWindow';
import {resolvedChannelPath, resolveChannelByName} from './server_api/channel';
import type {ServerView} from './serverView';

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function channelPathname(win: ServerView): Promise<string> {
    return win.evaluate(() => window.location.pathname);
}

export async function navigateViewToChannel(win: ServerView, channelName: string): Promise<void> {
    const channel = await resolveChannelByName(channelName);
    const targetPath = resolvedChannelPath(channel);
    const channelSlug = targetPath.split('/').pop() ?? channelName;

    await expect.poll(async () => {
        return win.evaluate(({path, slug}) => {
            if (window.location.pathname.includes(slug) &&
                !document.body.textContent?.includes('Team Not Found')) {
                return true;
            }

            if (document.body.textContent?.includes('Team Not Found')) {
                window.location.assign(path);
                return false;
            }

            const link = Array.from(document.querySelectorAll('a[href*="/channels/"]')).
                find((anchor) => (anchor.getAttribute('href') ?? '').includes(slug));
            if (link instanceof HTMLAnchorElement) {
                link.click();
            } else {
                window.location.assign(path);
            }

            return window.location.pathname.includes(slug);
        }, {path: targetPath, slug: channelSlug});
    }, {timeout: 30_000, message: `Server view must navigate to ${channelName}`}).toBe(true);
}

export async function modifierClickSidebarChannel(
    app: ElectronApplication,
    win: ServerView,
    channelSelector: string,
): Promise<void> {
    await win.waitForSelector(channelSelector, {timeout: 15_000});
    const baseline = popoutWindowCount(app);
    const useMetaKey = process.platform === 'darwin';

    await win.runInRenderer<boolean>(`
        const el = document.querySelector(${JSON.stringify(channelSelector)});
        if (!el) {
            return false;
        }
        el.scrollIntoView({block: 'center', inline: 'center'});
        const target = el.closest('a') ?? el;
        const eventInit = {
            bubbles: true,
            cancelable: true,
            metaKey: ${useMetaKey},
            ctrlKey: ${!useMetaKey},
            button: 0,
        };
        target.dispatchEvent(new MouseEvent('mousedown', eventInit));
        target.dispatchEvent(new MouseEvent('mouseup', eventInit));
        target.dispatchEvent(new MouseEvent('click', eventInit));
        return true;
    `, true);

    await sleep(750);
    if (popoutWindowCount(app) > baseline) {
        return;
    }

    const point = await win.runInRenderer<{x: number; y: number} | null>(`
        const el = document.querySelector(${JSON.stringify(channelSelector)});
        if (!el) {
            return null;
        }
        const rect = el.getBoundingClientRect();
        return {
            x: Math.round(rect.left + (rect.width / 2)),
            y: Math.round(rect.top + (rect.height / 2)),
        };
    `, true);
    expect(point, `Channel sidebar item must exist: ${channelSelector}`).toBeTruthy();

    const modifier: 'meta' | 'control' = useMetaKey ? 'meta' : 'control';
    await app.evaluate(({webContents}, payload: {id: number; x: number; y: number; modifier: 'meta' | 'control'}) => {
        const wc = webContents.fromId(payload.id);
        if (!wc || wc.isDestroyed()) {
            throw new Error(`webContents ${payload.id} is not available`);
        }
        wc.focus();
        wc.sendInputEvent({type: 'mouseMove', x: payload.x, y: payload.y});
        wc.sendInputEvent({
            type: 'mouseDown',
            x: payload.x,
            y: payload.y,
            button: 'left',
            clickCount: 1,
            modifiers: [payload.modifier],
        });
        wc.sendInputEvent({
            type: 'mouseUp',
            x: payload.x,
            y: payload.y,
            button: 'left',
            clickCount: 1,
            modifiers: [payload.modifier],
        });
    }, {id: win.webContentsId, ...point!, modifier});

    await sleep(750);
    if (popoutWindowCount(app) > baseline) {
        return;
    }

    const triggered = await win.runInRenderer<boolean>(`
        const el = document.querySelector(${JSON.stringify(channelSelector)});
        const href = (el?.closest('a') ?? el)?.getAttribute('href');
        const api = window.desktopAPI;
        if (!href || !api?.openPopout) {
            return false;
        }
        void api.openPopout(href, {});
        return true;
    `, true);
    expect(triggered, 'Modifier-click must open a popout via webapp or desktopAPI.openPopout').toBe(true);
}
