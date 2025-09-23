// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {localizeMessage} from 'main/i18nManager';

import createEditMenu from './edit';

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));

describe('app/menus/appMenu/edit', () => {
    beforeEach(() => {
        localizeMessage.mockImplementation((id) => {
            const translations = {
                'main.menus.app.edit': '&Edit',
                'main.menus.app.edit.undo': 'Undo',
                'main.menus.app.edit.redo': 'Redo',
                'main.menus.app.edit.cut': 'Cut',
                'main.menus.app.edit.copy': 'Copy',
                'main.menus.app.edit.paste': 'Paste',
                'main.menus.app.edit.pasteAndMatchStyle': 'Paste and Match Style',
                'main.menus.app.edit.selectAll': 'Select All',
            };
            return translations[id] || id;
        });
    });

    describe('createEditMenu', () => {
        it('should create edit menu with correct label', () => {
            const menu = createEditMenu();
            expect(menu.label).toBe('&Edit');
        });

        it('should include undo option with correct accelerator', () => {
            const menu = createEditMenu();
            const undoItem = menu.submenu.find((item) => item.role === 'undo');
            expect(undoItem).not.toBe(undefined);
            expect(undoItem.label).toBe('Undo');
            expect(undoItem.accelerator).toBe('CmdOrCtrl+Z');
        });

        it('should include redo option with correct accelerator', () => {
            const menu = createEditMenu();
            const redoItem = menu.submenu.find((item) => item.role === 'redo');
            expect(redoItem).not.toBe(undefined);
            expect(redoItem.label).toBe('Redo');
            expect(redoItem.accelerator).toBe('CmdOrCtrl+SHIFT+Z');
        });

        it('should include cut option with correct accelerator', () => {
            const menu = createEditMenu();
            const cutItem = menu.submenu.find((item) => item.role === 'cut');
            expect(cutItem).not.toBe(undefined);
            expect(cutItem.label).toBe('Cut');
            expect(cutItem.accelerator).toBe('CmdOrCtrl+X');
        });

        it('should include copy option with correct accelerator', () => {
            const menu = createEditMenu();
            const copyItem = menu.submenu.find((item) => item.role === 'copy');
            expect(copyItem).not.toBe(undefined);
            expect(copyItem.label).toBe('Copy');
            expect(copyItem.accelerator).toBe('CmdOrCtrl+C');
        });

        it('should include paste option with correct accelerator', () => {
            const menu = createEditMenu();
            const pasteItem = menu.submenu.find((item) => item.role === 'paste');
            expect(pasteItem).not.toBe(undefined);
            expect(pasteItem.label).toBe('Paste');
            expect(pasteItem.accelerator).toBe('CmdOrCtrl+V');
        });

        it('should include paste and match style option with correct accelerator', () => {
            const menu = createEditMenu();
            const pasteAndMatchStyleItem = menu.submenu.find((item) => item.role === 'pasteAndMatchStyle');
            expect(pasteAndMatchStyleItem).not.toBe(undefined);
            expect(pasteAndMatchStyleItem.label).toBe('Paste and Match Style');
            expect(pasteAndMatchStyleItem.accelerator).toBe('CmdOrCtrl+SHIFT+V');
        });

        it('should include select all option with correct accelerator', () => {
            const menu = createEditMenu();
            const selectAllItem = menu.submenu.find((item) => item.role === 'selectAll');
            expect(selectAllItem).not.toBe(undefined);
            expect(selectAllItem.label).toBe('Select All');
            expect(selectAllItem.accelerator).toBe('CmdOrCtrl+A');
        });

        it('should include separator between undo/redo and cut/copy/paste', () => {
            const menu = createEditMenu();
            const separators = menu.submenu.filter((item) => item.type === 'separator');
            expect(separators.length).toBe(1);

            // Find the position of the separator
            const redoIndex = menu.submenu.findIndex((item) => item.role === 'redo');
            const cutIndex = menu.submenu.findIndex((item) => item.role === 'cut');
            const separatorIndex = menu.submenu.findIndex((item) => item.type === 'separator');

            expect(separatorIndex).toBeGreaterThan(redoIndex);
            expect(separatorIndex).toBeLessThan(cutIndex);
        });

        it('should have correct menu structure', () => {
            const menu = createEditMenu();
            expect(menu.submenu).toHaveLength(8); // 6 menu items + 1 separator + 1 additional item

            const expectedRoles = ['undo', 'redo', 'cut', 'copy', 'paste', 'pasteAndMatchStyle', 'selectAll'];
            expectedRoles.forEach((role) => {
                const item = menu.submenu.find((item) => item.role === role);
                expect(item).not.toBe(undefined);
            });
        });

        it('should use localizeMessage for all labels', () => {
            createEditMenu();

            expect(localizeMessage).toHaveBeenCalledWith('main.menus.app.edit', '&Edit');
            expect(localizeMessage).toHaveBeenCalledWith('main.menus.app.edit.undo', 'Undo');
            expect(localizeMessage).toHaveBeenCalledWith('main.menus.app.edit.redo', 'Redo');
            expect(localizeMessage).toHaveBeenCalledWith('main.menus.app.edit.cut', 'Cut');
            expect(localizeMessage).toHaveBeenCalledWith('main.menus.app.edit.copy', 'Copy');
            expect(localizeMessage).toHaveBeenCalledWith('main.menus.app.edit.paste', 'Paste');
            expect(localizeMessage).toHaveBeenCalledWith('main.menus.app.edit.pasteAndMatchStyle', 'Paste and Match Style');
            expect(localizeMessage).toHaveBeenCalledWith('main.menus.app.edit.selectAll', 'Select All');
        });
    });
});
