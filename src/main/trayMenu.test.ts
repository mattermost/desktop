// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Menu, MenuItem} from 'electron';

import {createClickTrayMenuItem} from 'main/e2e/trayMenu';

function createMenuItem(partial: Partial<MenuItem> & {label?: string; click?: jest.Mock}): MenuItem {
    return {
        enabled: true,
        visible: true,
        click: jest.fn(),
        ...partial,
    } as MenuItem;
}

function createTrayMenu(items: MenuItem[]): Menu {
    return {items} as Menu;
}

describe('main/e2e/trayMenu', () => {
    describe('createClickTrayMenuItem', () => {
        it('should click a tray menu item by role', () => {
            const quitClick = jest.fn();
            const clickTrayMenuItem = createClickTrayMenuItem(() => createTrayMenu([
                createMenuItem({role: 'quit', click: quitClick}),
            ]));

            clickTrayMenuItem('role:quit');

            expect(quitClick).toHaveBeenCalled();
        });

        it('should match tray menu roles case-insensitively', () => {
            const quitClick = jest.fn();
            const clickTrayMenuItem = createClickTrayMenuItem(() => createTrayMenu([
                createMenuItem({role: 'quit', click: quitClick}),
            ]));

            clickTrayMenuItem('role:Quit');

            expect(quitClick).toHaveBeenCalled();
        });

        it('should ignore disabled or hidden role items', () => {
            const disabledQuit = jest.fn();
            const enabledQuit = jest.fn();
            const clickTrayMenuItem = createClickTrayMenuItem(() => createTrayMenu([
                createMenuItem({role: 'quit', enabled: false, click: disabledQuit}),
                createMenuItem({role: 'quit', visible: false, click: jest.fn()}),
                createMenuItem({role: 'quit', click: enabledQuit}),
            ]));

            clickTrayMenuItem('role:quit');

            expect(disabledQuit).not.toHaveBeenCalled();
            expect(enabledQuit).toHaveBeenCalled();
        });

        it('should throw when a tray menu role item is not found', () => {
            const clickTrayMenuItem = createClickTrayMenuItem(() => createTrayMenu([]));

            expect(() => clickTrayMenuItem('role:quit')).toThrow('Tray menu item with role not found: quit');
        });

        it('should click the tray settings menu item', () => {
            const settingsClick = jest.fn();
            const clickTrayMenuItem = createClickTrayMenuItem(() => createTrayMenu([
                createMenuItem({label: 'Settings', click: settingsClick}),
            ]));

            clickTrayMenuItem('tray:settings');

            expect(settingsClick).toHaveBeenCalled();
        });

        it('should throw when the tray settings menu item is not found', () => {
            const clickTrayMenuItem = createClickTrayMenuItem(() => createTrayMenu([]));

            expect(() => clickTrayMenuItem('tray:settings')).toThrow('Tray settings menu item not found');
        });

        it('should click a tray menu item by exact label', () => {
            const showClick = jest.fn();
            const clickTrayMenuItem = createClickTrayMenuItem(() => createTrayMenu([
                createMenuItem({label: 'Show Mattermost', click: showClick}),
            ]));

            clickTrayMenuItem('Show Mattermost');

            expect(showClick).toHaveBeenCalled();
        });

        it('should click a tray menu item by truncated label', () => {
            const longLabel = 'A'.repeat(60);
            const truncated = `${'A'.repeat(50)}...`;
            const longLabelClick = jest.fn();
            const clickTrayMenuItem = createClickTrayMenuItem(() => createTrayMenu([
                createMenuItem({label: truncated, click: longLabelClick}),
            ]));

            clickTrayMenuItem(longLabel);

            expect(longLabelClick).toHaveBeenCalled();
        });

        it('should throw when a tray menu label item is not found', () => {
            const clickTrayMenuItem = createClickTrayMenuItem(() => createTrayMenu([]));

            expect(() => clickTrayMenuItem('Missing Item')).toThrow('Tray menu item not found: Missing Item');
        });
    });
});
