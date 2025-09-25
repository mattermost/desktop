// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import WebContentsManager from 'app/views/webContentsManager';
import {localizeMessage} from 'main/i18nManager';

import createHistoryMenu from './history';

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));

jest.mock('app/views/webContentsManager', () => ({
    getFocusedView: jest.fn(),
}));

describe('app/menus/appMenu/history', () => {
    const mockView = {
        goToOffset: jest.fn(),
    };

    beforeEach(() => {
        WebContentsManager.getFocusedView.mockReturnValue(mockView);
        localizeMessage.mockImplementation((id) => {
            const translations = {
                'main.menus.app.history': '&History',
                'main.menus.app.history.back': 'Back',
                'main.menus.app.history.forward': 'Forward',
            };
            return translations[id] || id;
        });
    });

    describe('createHistoryMenu', () => {
        it('should create history menu with correct label', () => {
            const menu = createHistoryMenu();
            expect(menu.label).toBe('&History');
        });

        it('should include back option with correct accelerator for macOS', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });

            const menu = createHistoryMenu();
            const backItem = menu.submenu.find((item) => item.label === 'Back');
            expect(backItem).not.toBe(undefined);
            expect(backItem.accelerator).toBe('Cmd+[');

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should include back option with correct accelerator for non-macOS', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            const menu = createHistoryMenu();
            const backItem = menu.submenu.find((item) => item.label === 'Back');
            expect(backItem).not.toBe(undefined);
            expect(backItem.accelerator).toBe('Alt+Left');

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should include forward option with correct accelerator for macOS', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });

            const menu = createHistoryMenu();
            const forwardItem = menu.submenu.find((item) => item.label === 'Forward');
            expect(forwardItem).not.toBe(undefined);
            expect(forwardItem.accelerator).toBe('Cmd+]');

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should include forward option with correct accelerator for non-macOS', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            const menu = createHistoryMenu();
            const forwardItem = menu.submenu.find((item) => item.label === 'Forward');
            expect(forwardItem).not.toBe(undefined);
            expect(forwardItem.accelerator).toBe('Alt+Right');

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should call WebContentsManager.getFocusedView().goToOffset(-1) when back is clicked', () => {
            const menu = createHistoryMenu();
            const backItem = menu.submenu.find((item) => item.label === 'Back');
            backItem.click();
            expect(WebContentsManager.getFocusedView).toHaveBeenCalled();
            expect(mockView.goToOffset).toHaveBeenCalledWith(-1);
        });

        it('should call WebContentsManager.getFocusedView().goToOffset(1) when forward is clicked', () => {
            const menu = createHistoryMenu();
            const forwardItem = menu.submenu.find((item) => item.label === 'Forward');
            forwardItem.click();
            expect(WebContentsManager.getFocusedView).toHaveBeenCalled();
            expect(mockView.goToOffset).toHaveBeenCalledWith(1);
        });

        it('should handle back click when no focused view is available', () => {
            WebContentsManager.getFocusedView.mockReturnValue(null);
            const menu = createHistoryMenu();
            const backItem = menu.submenu.find((item) => item.label === 'Back');

            // Should not throw an error when no view is available
            expect(() => backItem.click()).not.toThrow();
        });

        it('should handle forward click when no focused view is available', () => {
            WebContentsManager.getFocusedView.mockReturnValue(null);
            const menu = createHistoryMenu();
            const forwardItem = menu.submenu.find((item) => item.label === 'Forward');

            // Should not throw an error when no view is available
            expect(() => forwardItem.click()).not.toThrow();
        });

        it('should have correct menu structure', () => {
            const menu = createHistoryMenu();
            expect(menu.submenu).toHaveLength(2);

            const backItem = menu.submenu.find((item) => item.label === 'Back');
            const forwardItem = menu.submenu.find((item) => item.label === 'Forward');

            expect(backItem).not.toBe(undefined);
            expect(forwardItem).not.toBe(undefined);
        });

        it('should use localizeMessage for all labels', () => {
            createHistoryMenu();

            expect(localizeMessage).toHaveBeenCalledWith('main.menus.app.history', '&History');
            expect(localizeMessage).toHaveBeenCalledWith('main.menus.app.history.back', 'Back');
            expect(localizeMessage).toHaveBeenCalledWith('main.menus.app.history.forward', 'Forward');
        });

        it('should use arrow functions for click handlers', () => {
            const menu = createHistoryMenu();
            const backItem = menu.submenu.find((item) => item.label === 'Back');
            const forwardItem = menu.submenu.find((item) => item.label === 'Forward');

            expect(typeof backItem.click).toBe('function');
            expect(typeof forwardItem.click).toBe('function');
        });
    });
});
