// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Menu} from 'electron';

export function createClickTrayMenuItem(getTrayMenu: () => Menu) {
    return (label: string) => {
        const truncated = label.length > 50 ? `${label.slice(0, 50)}...` : label;

        function clickItem(items: Electron.MenuItem[]): boolean {
            for (const item of items) {
                const itemLabel = typeof item.label === 'string' ? item.label : '';
                if (
                    (itemLabel === label || itemLabel === truncated) &&
                    item.enabled !== false &&
                    item.visible !== false &&
                    typeof item.click === 'function'
                ) {
                    item.click();
                    return true;
                }
                if (item.submenu?.items && clickItem(item.submenu.items)) {
                    return true;
                }
            }
            return false;
        }

        if (!clickItem(getTrayMenu().items)) {
            throw new Error(`Tray menu item not found: ${label}`);
        }
    };
}
