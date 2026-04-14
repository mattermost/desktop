// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {clipboard} from 'electron';

import ContextMenu from './contextMenu';

jest.mock('electron', () => ({
    clipboard: {
        writeText: jest.fn(),
    },
}));

jest.mock('electron-context-menu', () => {
    return () => jest.fn();
});

jest.mock('main/i18nManager', () => ({
    localizeMessage: (key, defaultString) => defaultString,
}));

describe('main/contextMenu', () => {
    describe('shouldShowMenu', () => {
        const contextMenu = new ContextMenu({}, {webContents: {}});

        it('should not show menu on internal link', () => {
            expect(contextMenu.menuOptions.shouldShowMenu(null, {
                mediaType: 'none',
                linkURL: 'http://server-1.com/subpath#',
                pageURL: 'http://server-1.com/subpath',
                srcURL: '',
                misspelledWord: '',
                selectionText: '',
            })).toBe(false);
        });

        it('should not show menu on buttons', () => {
            expect(contextMenu.menuOptions.shouldShowMenu(null, {
                mediaType: 'none',
                linkURL: '',
                pageURL: 'http://server-1.com/subpath',
                srcURL: '',
                misspelledWord: '',
                selectionText: '',
            })).toBe(false);
        });

        it('should show menu on editables', () => {
            expect(contextMenu.menuOptions.shouldShowMenu(null, {
                mediaType: 'none',
                linkURL: '',
                pageURL: 'http://server-1.com/subpath',
                srcURL: '',
                misspelledWord: '',
                selectionText: '',
                isEditable: true,
            })).toBe(true);
        });

        it('should show menu on images', () => {
            expect(contextMenu.menuOptions.shouldShowMenu(null, {
                mediaType: 'image',
                linkURL: '',
                pageURL: 'http://server-1.com/subpath',
                srcURL: 'http://server-1.com/subpath/image.png',
                misspelledWord: '',
                selectionText: '',
                isEditable: true,
            })).toBe(true);
        });

        it('should show menu on external links', () => {
            expect(contextMenu.menuOptions.shouldShowMenu(null, {
                mediaType: 'none',
                linkURL: 'http://server-2.com/link',
                pageURL: 'http://server-1.com/subpath',
                srcURL: '',
                misspelledWord: '',
                selectionText: '',
                isEditable: true,
            })).toBe(true);
        });
    });

    describe('append', () => {
        const mockDefaultActions = {};

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should return empty array for non-mailto links', () => {
            const contextMenu = new ContextMenu({}, {webContents: {}});
            const items = contextMenu.menuOptions.append(mockDefaultActions, {linkURL: 'https://example.com'});
            expect(items).toHaveLength(0);
        });

        it('should include Copy Email Address for mailto links', () => {
            const contextMenu = new ContextMenu({}, {webContents: {}});
            const items = contextMenu.menuOptions.append(mockDefaultActions, {linkURL: 'mailto:user@example.com'});
            expect(items).toHaveLength(1);
            expect(items[0].label).toBe('Copy Email Address');

            items[0].click();
            expect(clipboard.writeText).toHaveBeenCalledWith('user@example.com');
        });

        it('should include items from provided append after the default items', () => {
            const providedAppend = jest.fn().mockReturnValue([{label: 'Extra Item'}]);
            const contextMenu = new ContextMenu({append: providedAppend}, {webContents: {}});

            const items = contextMenu.menuOptions.append(mockDefaultActions, {linkURL: 'mailto:user@example.com'}, null, null);
            expect(items).toHaveLength(2);
            expect(items[0].label).toBe('Copy Email Address');
            expect(items[1].label).toBe('Extra Item');
            expect(providedAppend).toHaveBeenCalled();
        });
    });

    describe('reload', () => {
        it('should call dispose on reload', () => {
            const contextMenu = new ContextMenu({}, {webContents: {}});
            const fn = contextMenu.menuDispose;
            contextMenu.reload();
            expect(fn).toHaveBeenCalled();
        });
    });
});
