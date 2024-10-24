// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import ContextMenu from './contextMenu';

jest.mock('electron-context-menu', () => {
    return () => jest.fn();
});

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

    describe('reload', () => {
        it('should call dispose on reload', () => {
            const contextMenu = new ContextMenu({}, {webContents: {}});
            const fn = contextMenu.menuDispose;
            contextMenu.reload();
            expect(fn).toHaveBeenCalled();
        });
    });
});
