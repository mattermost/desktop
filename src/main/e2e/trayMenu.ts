// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Menu, MenuItem} from 'electron';

function normalizeTrayMenuLabel(value: string): string {
    return value.toLowerCase().replace(/&/g, '').replace(/[.\u2026…]+$/u, '').trim();
}

function trayMenuLabelMatches(itemLabel: string, label: string, truncated: string): boolean {
    const normalizedItem = normalizeTrayMenuLabel(itemLabel);
    const normalizedTarget = normalizeTrayMenuLabel(label);
    return itemLabel === label ||
        itemLabel === truncated ||
        normalizedItem === normalizedTarget;
}

function normalizeTrayMenuRole(role: string): string {
    return role.toLowerCase();
}

function clickTrayMenuItemsByRole(items: MenuItem[], role: string): boolean {
    const normalizedRole = normalizeTrayMenuRole(role);
    for (const item of items) {
        if (
            item.role &&
            normalizeTrayMenuRole(item.role) === normalizedRole &&
            item.enabled !== false &&
            item.visible !== false &&
            typeof item.click === 'function'
        ) {
            item.click();
            return true;
        }
        if (item.submenu?.items && clickTrayMenuItemsByRole(item.submenu.items, role)) {
            return true;
        }
    }
    return false;
}

function findTrayMenuItemByLabelPredicate(
    items: MenuItem[],
    predicate: (normalizedLabel: string, itemLabel: string) => boolean,
): MenuItem | null {
    for (const item of items) {
        const itemLabel = typeof item.label === 'string' ? item.label : '';
        if (
            predicate(normalizeTrayMenuLabel(itemLabel), itemLabel) &&
            item.enabled !== false &&
            item.visible !== false &&
            typeof item.click === 'function'
        ) {
            return item;
        }
        if (item.submenu?.items) {
            const nested = findTrayMenuItemByLabelPredicate(item.submenu.items, predicate);
            if (nested) {
                return nested;
            }
        }
    }
    return null;
}

function clickTrayMenuItems(items: MenuItem[], label: string, truncated: string): boolean {
    const item = findTrayMenuItemByLabelPredicate(items, (normalized, raw) =>
        trayMenuLabelMatches(raw, label, truncated) || normalized === normalizeTrayMenuLabel(label),
    );
    if (!item) {
        return false;
    }
    item.click();
    return true;
}

function clickTraySettingsMenuItem(items: MenuItem[]): boolean {
    const item = findTrayMenuItemByLabelPredicate(items, (normalized) =>
        normalized === 'settings' ||
        normalized === 'preferences' ||
        normalized.startsWith('settings') ||
        normalized.startsWith('preferences'),
    );
    if (!item) {
        return false;
    }
    item.click();
    return true;
}

export function createClickTrayMenuItem(getTrayMenu: () => Menu) {
    return (label: string) => {
        if (label.startsWith('role:')) {
            const role = label.slice('role:'.length);
            if (!clickTrayMenuItemsByRole(getTrayMenu().items, role)) {
                throw new Error(`Tray menu item with role not found: ${role}`);
            }
            return;
        }

        if (label === 'tray:settings') {
            if (!clickTraySettingsMenuItem(getTrayMenu().items)) {
                throw new Error('Tray settings menu item not found');
            }
            return;
        }

        const truncated = label.length > 50 ? `${label.slice(0, 50)}...` : label;
        if (!clickTrayMenuItems(getTrayMenu().items, label, truncated)) {
            throw new Error(`Tray menu item not found: ${label}`);
        }
    };
}
