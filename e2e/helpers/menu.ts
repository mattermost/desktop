// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {waitForAppReady} from './appReadiness';
import {isTransientEvaluateError} from './testRefs';

type MenuItemMatcher = {
    id?: string;
    label?: string;
    labelIncludes?: string;
    role?: string;
    accelerator?: string;
};

type ClickMenuItemOptions = {
    webContentsId?: number;
};

export async function clickApplicationMenuItem(
    app: ElectronApplication,
    menuId: string,
    matcher: MenuItemMatcher,
    options?: ClickMenuItemOptions,
) {
    const deadline = Date.now() + 15_000;

    while (Date.now() < deadline) {
        try {
            await app.evaluate(({app: electronAppInstance, BrowserWindow, webContents, Menu}, payload) => {
                const normalizeAccelerator = (value?: string) => {
                    return (value ?? '').
                        toLowerCase().
                        replace(/commandorcontrol/g, 'cmdorctrl').
                        replace(/command/g, 'cmd').
                        replace(/control/g, 'ctrl').
                        replace(/option/g, 'alt').
                        replace(/\s+/g, '');
                };

                const topLevelMenu = electronAppInstance.applicationMenu?.getMenuItemById(payload.menuId);
                const rootItems = topLevelMenu?.submenu?.items ?? [];
                const stack = [...rootItems];
                const items: any[] = [];

                while (stack.length > 0) {
                    const candidate = stack.shift();
                    if (!candidate) {
                        continue;
                    }

                    items.push(candidate);
                    const submenuItems = candidate.submenu?.items ?? [];
                    stack.push(...submenuItems);
                }

                const {id, role, accelerator, label, labelIncludes} = payload.matcher;
                if (!id && !role && !accelerator && !label && !labelIncludes) {
                    throw new Error('Menu item matcher must specify at least one criterion (id, role, accelerator, label, or labelIncludes)');
                }

                const item = items.find((candidate: any) => {
                    if (payload.matcher.id && candidate.id !== payload.matcher.id) {
                        return false;
                    }
                    if (payload.matcher.role && candidate.role !== payload.matcher.role) {
                        return false;
                    }
                    if (
                        payload.matcher.accelerator &&
                        normalizeAccelerator(candidate.accelerator) !== normalizeAccelerator(payload.matcher.accelerator)
                    ) {
                        return false;
                    }

                    const label = typeof candidate.label === 'string' ? candidate.label.trim() : '';
                    if (payload.matcher.label && label !== payload.matcher.label) {
                        return false;
                    }
                    if (payload.matcher.labelIncludes && !label.includes(payload.matcher.labelIncludes)) {
                        return false;
                    }
                    return true;
                });

                if (!item) {
                    throw new Error(`Menu item not found in ${payload.menuId}: ${JSON.stringify(payload.matcher)}`);
                }

                // getFocusedWindow() returns null on headless CI; fall back to the
                // main window ref set by the app's E2E test hooks.
                const refs = (global as any).__e2eTestRefs;
                const targetWindow = BrowserWindow.getFocusedWindow() ??
                    refs?.MainWindow?.get?.() ??
                    BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) ??
                    null;
                const targetWebContents = payload.webContentsId ? webContents.fromId(payload.webContentsId) : targetWindow?.webContents;

                if (process.platform === 'darwin' && payload.menuId === 'edit' && payload.matcher.role) {
                    const responderActionByRole: Record<string, string> = {
                        undo: 'undo:',
                        redo: 'redo:',
                        cut: 'cut:',
                        copy: 'copy:',
                        paste: 'paste:',
                        selectAll: 'selectAll:',
                    };
                    const action = responderActionByRole[payload.matcher.role];
                    if (action) {
                        targetWindow?.focus();
                        targetWebContents?.focus();
                        Menu.sendActionToFirstResponder(action);
                        return;
                    }
                }

                item.click(undefined, targetWindow, targetWebContents);
            }, {
                menuId,
                matcher,
                webContentsId: options?.webContentsId,
            });
            return;
        } catch (error) {
            if (!isTransientEvaluateError(error)) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    throw new Error(`Timed out clicking menu item ${menuId}: ${JSON.stringify(matcher)}`);
}

/**
 * Open the "Sign in to Another Server" modal via the application menu.
 * Uses direct menu-item invocation (reliable on headless Windows CI).
 */
export async function openSignInToAnotherServerModal(app: ElectronApplication) {
    await waitForAppReady(app);

    const menuId = process.platform === 'darwin' ? 'app' : 'file';
    const newServerWindowPromise = app.waitForEvent('window', {
        predicate: (window) => window.url().includes('newServer'),
        timeout: 30_000,
    });

    const opened = await app.evaluate(({app: electronAppInstance}, targetMenuId) => {
        const root = electronAppInstance.applicationMenu?.getMenuItemById(targetMenuId);
        const stack = [...(root?.submenu?.items ?? [])];
        while (stack.length) {
            const item = stack.shift()!;
            const label = typeof item.label === 'string' ? item.label : '';
            if (label.includes('Sign in') && label.includes('Server')) {
                item.click();
                return true;
            }
            if (item.submenu?.items) {
                stack.push(...item.submenu.items);
            }
        }
        return false;
    }, menuId);

    if (!opened) {
        await clickApplicationMenuItem(app, menuId, {labelIncludes: 'Sign in'});
    }

    return newServerWindowPromise;
}
