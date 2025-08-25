// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {clipboard, Menu} from 'electron';

import WebContentsManager from 'app/views/webContentsManager';
import {ViewType} from 'common/views/MattermostView';
import ViewManager from 'common/views/viewManager';
import {localizeMessage} from 'main/i18nManager';

import PopoutMenu from './popoutMenu';
import TabManager from './tabs/tabManager';

jest.mock('electron', () => ({
    clipboard: {
        writeText: jest.fn(),
    },
    Menu: {
        buildFromTemplate: jest.fn(),
    },
}));

jest.mock('app/views/webContentsManager', () => ({
    getView: jest.fn(),
}));

jest.mock('common/views/MattermostView', () => ({
    ViewType: {
        TAB: 'TAB',
        WINDOW: 'WINDOW',
    },
}));

jest.mock('common/views/viewManager', () => ({
    getView: jest.fn(),
    updateViewType: jest.fn(),
    removeView: jest.fn(),
}));

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));

jest.mock('./tabs/tabManager', () => ({
    getOrderedTabsForServer: jest.fn(),
}));

describe('main/app/popoutMenu', () => {
    const mockViewId = 'test-view-id';
    const mockServerId = 'test-server-id';
    const mockUrl = 'https://example.com/test';

    const mockView = {
        id: mockViewId,
        serverId: mockServerId,
        type: ViewType.TAB,
    };

    const mockWebContentsView = {
        getWebContentsView: () => ({
            webContents: {
                getURL: () => mockUrl,
            },
        }),
    };

    const mockMenu = {
        popup: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Default mock implementations
        ViewManager.getView.mockReturnValue(mockView);
        WebContentsManager.getView.mockReturnValue(mockWebContentsView);
        TabManager.getOrderedTabsForServer.mockReturnValue([mockView]);
        Menu.buildFromTemplate.mockReturnValue(mockMenu);

        localizeMessage.mockImplementation((id) => {
            const messages = {
                'main.menus.popoutMenu.copyLink': 'Copy Link',
                'main.menus.popoutMenu.moveToMainWindow': 'Move to main window',
                'main.menus.popoutMenu.moveToNewWindow': 'Move to new window',
                'main.menus.popoutMenu.closeWindow': 'Close window',
                'main.menus.popoutMenu.closeTab': 'Close tab',
            };
            return messages[id] || id;
        });
    });

    describe('createTemplate', () => {
        it('should return empty array when view is not found', () => {
            ViewManager.getView.mockReturnValue(null);

            PopoutMenu(mockViewId);

            expect(Menu.buildFromTemplate).toHaveBeenCalledWith([]);
        });

        it('should create copy link menu item', () => {
            PopoutMenu(mockViewId);

            expect(Menu.buildFromTemplate).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        label: 'Copy Link',
                        click: expect.any(Function),
                    }),
                ]),
            );
        });

        it('should copy URL to clipboard when copy link is clicked', () => {
            let capturedTemplate;
            Menu.buildFromTemplate.mockImplementation((template) => {
                capturedTemplate = template;
                return mockMenu;
            });

            PopoutMenu(mockViewId);

            const copyLinkItem = capturedTemplate.find((item) => item.label === 'Copy Link');
            copyLinkItem.click();

            expect(clipboard.writeText).toHaveBeenCalledWith(mockUrl);
        });

        it('should not copy URL when webContentsView is not found', () => {
            WebContentsManager.getView.mockReturnValue(null);
            let capturedTemplate;
            Menu.buildFromTemplate.mockImplementation((template) => {
                capturedTemplate = template;
                return mockMenu;
            });

            PopoutMenu(mockViewId);

            const copyLinkItem = capturedTemplate.find((item) => item.label === 'Copy Link');
            copyLinkItem.click();

            expect(clipboard.writeText).not.toHaveBeenCalled();
        });

        describe('when view is a tab and not the last tab', () => {
            beforeEach(() => {
                TabManager.getOrderedTabsForServer.mockReturnValue([mockView, {id: 'another-tab'}]);
            });

            it('should include separator and move/close options', () => {
                let capturedTemplate;
                Menu.buildFromTemplate.mockImplementation((template) => {
                    capturedTemplate = template;
                    return mockMenu;
                });

                PopoutMenu(mockViewId);

                expect(capturedTemplate).toContainEqual(expect.objectContaining({type: 'separator'}));
                expect(capturedTemplate).toContainEqual(expect.objectContaining({
                    label: 'Move to new window',
                    click: expect.any(Function),
                }));
                expect(capturedTemplate).toContainEqual(expect.objectContaining({
                    label: 'Close tab',
                    click: expect.any(Function),
                }));
            });

            it('should move tab to window when move option is clicked', () => {
                let capturedTemplate;
                Menu.buildFromTemplate.mockImplementation((template) => {
                    capturedTemplate = template;
                    return mockMenu;
                });

                PopoutMenu(mockViewId);

                const moveItem = capturedTemplate.find((item) => item.label === 'Move to new window');
                moveItem.click();

                expect(ViewManager.updateViewType).toHaveBeenCalledWith(mockViewId, ViewType.WINDOW);
            });

            it('should remove view when close option is clicked', () => {
                let capturedTemplate;
                Menu.buildFromTemplate.mockImplementation((template) => {
                    capturedTemplate = template;
                    return mockMenu;
                });

                PopoutMenu(mockViewId);

                const closeItem = capturedTemplate.find((item) => item.label === 'Close tab');
                closeItem.click();

                expect(ViewManager.removeView).toHaveBeenCalledWith(mockViewId);
            });
        });

        describe('when view is a window', () => {
            beforeEach(() => {
                const windowView = {...mockView, type: ViewType.WINDOW};
                ViewManager.getView.mockReturnValue(windowView);
                TabManager.getOrderedTabsForServer.mockReturnValue([windowView, {id: 'another-tab'}]);
            });

            it('should show move to main window option', () => {
                let capturedTemplate;
                Menu.buildFromTemplate.mockImplementation((template) => {
                    capturedTemplate = template;
                    return mockMenu;
                });

                PopoutMenu(mockViewId);

                expect(capturedTemplate).toContainEqual(expect.objectContaining({
                    label: 'Move to main window',
                    click: expect.any(Function),
                }));
            });

            it('should show close window option', () => {
                let capturedTemplate;
                Menu.buildFromTemplate.mockImplementation((template) => {
                    capturedTemplate = template;
                    return mockMenu;
                });

                PopoutMenu(mockViewId);

                expect(capturedTemplate).toContainEqual(expect.objectContaining({
                    label: 'Close window',
                    click: expect.any(Function),
                }));
            });

            it('should move window to tab when move option is clicked', () => {
                let capturedTemplate;
                Menu.buildFromTemplate.mockImplementation((template) => {
                    capturedTemplate = template;
                    return mockMenu;
                });

                PopoutMenu(mockViewId);

                const moveItem = capturedTemplate.find((item) => item.label === 'Move to main window');
                moveItem.click();

                expect(ViewManager.updateViewType).toHaveBeenCalledWith(mockViewId, ViewType.TAB);
            });
        });

        describe('when view is the last tab', () => {
            beforeEach(() => {
                TabManager.getOrderedTabsForServer.mockReturnValue([mockView]);
            });

            it('should not include separator and move/close options', () => {
                let capturedTemplate;
                Menu.buildFromTemplate.mockImplementation((template) => {
                    capturedTemplate = template;
                    return mockMenu;
                });

                PopoutMenu(mockViewId);

                expect(capturedTemplate).not.toContainEqual(expect.objectContaining({type: 'separator'}));
                expect(capturedTemplate).not.toContainEqual(expect.objectContaining({
                    label: 'Move to new window',
                }));
                expect(capturedTemplate).not.toContainEqual(expect.objectContaining({
                    label: 'Close tab',
                }));
            });

            it('should only include copy link option', () => {
                let capturedTemplate;
                Menu.buildFromTemplate.mockImplementation((template) => {
                    capturedTemplate = template;
                    return mockMenu;
                });

                PopoutMenu(mockViewId);

                expect(capturedTemplate).toHaveLength(1);
                expect(capturedTemplate[0]).toEqual(expect.objectContaining({
                    label: 'Copy Link',
                    click: expect.any(Function),
                }));
            });
        });
    });
});

