// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MenuItem} from 'electron';

import createTrayMenu from 'app/menus/tray';

function normalizeTrayMenuLabel(value: string): string {
    return value.toLowerCase().replace(/&/g, '').replace(/\.+$/, '').trim();
}

function trayMenuLabelMatches(itemLabel: string, label: string, truncated: string): boolean {
    const normalizedItem = normalizeTrayMenuLabel(itemLabel);
    const normalizedTarget = normalizeTrayMenuLabel(label);
    return itemLabel === label ||
        itemLabel === truncated ||
        normalizedItem === normalizedTarget;
}

function clickTrayMenuItemsByRole(items: MenuItem[], role: string): boolean {
    for (const item of items) {
        if (item.role === role && typeof item.click === 'function') {
            item.click();
            return true;
        }
        if (item.submenu?.items && clickTrayMenuItemsByRole(item.submenu.items, role)) {
            return true;
        }
    }
    return false;
}

function clickTrayMenuItems(items: MenuItem[], label: string, truncated: string): boolean {
    for (const item of items) {
        const itemLabel = typeof item.label === 'string' ? item.label : '';
        if (
            trayMenuLabelMatches(itemLabel, label, truncated) &&
            item.enabled !== false &&
            item.visible !== false &&
            typeof item.click === 'function'
        ) {
            item.click();
            return true;
        }
        if (item.submenu?.items && clickTrayMenuItems(item.submenu.items, label, truncated)) {
            return true;
        }
    }
    return false;
}

export function createClickTrayMenuItemHandler(): (label: string) => void {
    return (label: string) => {
        if (label.startsWith('role:')) {
            const role = label.slice('role:'.length);
            if (!clickTrayMenuItemsByRole(createTrayMenu().items, role)) {
                throw new Error(`Tray menu item with role not found: ${role}`);
            }
            return;
        }

        const truncated = label.length > 50 ? `${label.slice(0, 50)}...` : label;
        if (!clickTrayMenuItems(createTrayMenu().items, label, truncated)) {
            throw new Error(`Tray menu item not found: ${label}`);
        }
    };
}
