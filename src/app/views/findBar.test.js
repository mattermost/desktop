// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {FIND_BAR_FOCUS, FIND_BAR_OPEN, FIND_BAR_RESULT} from 'common/communication';
import {FIND_BAR_HEIGHT, FIND_BAR_MARGIN, FIND_BAR_WIDTH} from 'common/utils/constants';

import {FindBar, closeFindBar, openFindBar} from './findBar';

jest.mock('electron', () => {
    return {
        ipcMain: {
            on: jest.fn(),
        },
        WebContentsView: jest.fn().mockImplementation(() => ({
            webContents: {
                id: 99,
                loadURL: jest.fn(),
                send: jest.fn(),
                focus: jest.fn(),
                close: jest.fn(),
                isDestroyed: jest.fn(() => false),
            },
            setBackgroundColor: jest.fn(),
            setVisible: jest.fn(),
            setBounds: jest.fn(),
        })),
    };
});
jest.mock('common/log', () => ({
    Logger: jest.fn().mockImplementation(() => ({
        debug: jest.fn(),
        error: jest.fn(),
    })),
}));
jest.mock('main/performanceMonitor', () => ({
    registerView: jest.fn(),
    unregisterView: jest.fn(),
}));
jest.mock('main/themeManager', () => ({
    registerMainWindowView: jest.fn(),
}));
jest.mock('main/utils', () => ({
    getLocalPreload: jest.fn(() => 'internalAPI.js'),
}));
jest.mock('common/Validator', () => ({
    ipcValidate: (handler) => handler,
}));

function createParentWindow() {
    return {
        webContents: {id: 1},
        contentView: {
            addChildView: jest.fn(),
            children: [],
        },
        on: jest.fn(),
        isDestroyed: jest.fn(() => false),
    };
}

function createTargetWebContents() {
    return {
        id: 7,
        on: jest.fn(),
        off: jest.fn(),
        findInPage: jest.fn(),
        stopFindInPage: jest.fn(),
        isDestroyed: jest.fn(() => false),
    };
}

describe('app/views/findBar', () => {
    const viewBounds = {x: 0, y: 40, width: 1280, height: 760};

    describe('open and close', () => {
        it('should show the overlay and start a new find session', () => {
            const parent = createParentWindow();
            const target = createTargetWebContents();
            const findBar = new FindBar(parent);

            findBar.open(target, viewBounds);

            expect(findBar.view.setVisible).toHaveBeenCalledWith(true);
            expect(findBar.view.webContents.send).toHaveBeenCalledWith(FIND_BAR_OPEN);
            expect(findBar.view.webContents.focus).toHaveBeenCalled();
            expect(target.on).toHaveBeenCalledWith('found-in-page', expect.any(Function));
            expect(findBar.view.setBounds).toHaveBeenCalledWith({
                x: viewBounds.x + (viewBounds.width - FIND_BAR_WIDTH - FIND_BAR_MARGIN),
                y: viewBounds.y + FIND_BAR_MARGIN,
                width: FIND_BAR_WIDTH,
                height: FIND_BAR_HEIGHT,
            });
        });

        it('should focus an already-open find bar instead of resetting it', () => {
            const parent = createParentWindow();
            const target = createTargetWebContents();
            const findBar = new FindBar(parent);

            findBar.open(target, viewBounds);
            findBar.find('bots', {findNext: true});
            findBar.view.webContents.send.mockClear();

            findBar.open(target, viewBounds);

            expect(findBar.view.webContents.send).toHaveBeenCalledWith(FIND_BAR_FOCUS);
        });

        it('should stop findInPage and hide when closed', () => {
            const parent = createParentWindow();
            const target = createTargetWebContents();
            const findBar = new FindBar(parent);

            findBar.open(target, viewBounds);
            findBar.find('bots', {findNext: true});
            findBar.close();

            expect(target.stopFindInPage).toHaveBeenCalledWith('clearSelection');
            expect(target.off).toHaveBeenCalledWith('found-in-page', expect.any(Function));
            expect(findBar.view.setVisible).toHaveBeenCalledWith(false);
        });

        it('should ignore close when a different view is the target', () => {
            const parent = createParentWindow();
            const target = createTargetWebContents();
            const other = createTargetWebContents();
            const findBar = new FindBar(parent);

            findBar.open(target, viewBounds);
            findBar.close(other);

            expect(target.stopFindInPage).not.toHaveBeenCalled();
            expect(findBar.isVisible).toBe(true);
        });
    });

    describe('find', () => {
        it('should start a new session when the query changes', () => {
            const parent = createParentWindow();
            const target = createTargetWebContents();
            const findBar = new FindBar(parent);

            findBar.open(target, viewBounds);
            findBar.find('bot', {findNext: true});

            expect(target.findInPage).toHaveBeenCalledWith('bot', {forward: true, findNext: true});
        });

        it('should continue the current session for next and previous', () => {
            const parent = createParentWindow();
            const target = createTargetWebContents();
            const findBar = new FindBar(parent);

            findBar.open(target, viewBounds);
            findBar.find('bot', {findNext: true});
            findBar.findNext();
            findBar.findPrevious();

            expect(target.findInPage).toHaveBeenNthCalledWith(2, 'bot', {forward: true, findNext: false});
            expect(target.findInPage).toHaveBeenNthCalledWith(3, 'bot', {forward: false, findNext: false});
        });

        it('should clear the selection when the query is empty', () => {
            const parent = createParentWindow();
            const target = createTargetWebContents();
            const findBar = new FindBar(parent);

            findBar.open(target, viewBounds);
            findBar.find('bot', {findNext: true});
            findBar.find('   ');

            expect(target.stopFindInPage).toHaveBeenCalledWith('clearSelection');
            expect(findBar.view.webContents.send).toHaveBeenCalledWith(FIND_BAR_RESULT, {activeMatchOrdinal: 0, matches: 0});
        });

        it('should forward final found-in-page results to the renderer', () => {
            const parent = createParentWindow();
            const target = createTargetWebContents();
            const findBar = new FindBar(parent);

            findBar.open(target, viewBounds);
            const onFound = target.on.mock.calls.find(([eventName]) => eventName === 'found-in-page')[1];
            onFound({}, {finalUpdate: true, activeMatchOrdinal: 2, matches: 5});

            expect(findBar.view.webContents.send).toHaveBeenCalledWith(FIND_BAR_RESULT, {activeMatchOrdinal: 2, matches: 5});
        });
    });

    describe('helpers', () => {
        it('should open and close through the exported helpers', () => {
            const parent = createParentWindow();
            const target = createTargetWebContents();

            openFindBar(parent, target, viewBounds);
            expect(target.on).toHaveBeenCalledWith('found-in-page', expect.any(Function));

            closeFindBar(parent, target);
            expect(target.stopFindInPage).toHaveBeenCalledWith('clearSelection');
        });
    });
});
