// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

export async function clickHistoryMenuItem(app: ElectronApplication, label: 'Back' | 'Forward'): Promise<void> {
    const clicked = await app.evaluate(({Menu}, itemLabel) => {
        const root = Menu.getApplicationMenu();
        if (!root) {
            return false;
        }
        const stack = [...root.items];
        while (stack.length) {
            const item = stack.shift()!;
            if (item.label === '&History' || item.label === 'History') {
                const target = item.submenu?.items?.find((sub) => sub.label === itemLabel);
                if (target) {
                    target.click();
                    return true;
                }
            }
            if (item.submenu) {
                stack.push(...item.submenu.items);
            }
        }
        return false;
    }, label);
    if (!clicked) {
        throw new Error(`History menu item not found: ${label}`);
    }
}
