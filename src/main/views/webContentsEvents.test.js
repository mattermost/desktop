// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import urlUtils from 'common/utils/url';

import * as WebContentsEvents from './webContentEvents';

jest.mock('electron', () => ({
    app: {},
}));

jest.mock('electron-log', () => ({
    info: jest.fn(),
}));

jest.mock('../allowProtocolDialog', () => ({}));
jest.mock('../windows/windowManager', () => ({}));

jest.mock('common/utils/url', () => ({
    parseURL: (url) => new URL(url),
    getView: jest.fn(),
    isTeamUrl: jest.fn(),
    isAdminUrl: jest.fn(),
    isTrustedPopupWindow: jest.fn(),
    isCustomLoginURL: jest.fn(),
}));

describe('main/views/webContentsEvents', () => {
    describe('willNavigate', () => {
        const event = {preventDefault: jest.fn(), sender: {id: 1}};

        beforeEach(() => {
            urlUtils.getView.mockImplementation(() => ({name: 'server_name', url: 'http://server-1.com'}));
        });

        it('should allow navigation when url isTeamURL', () => {
            urlUtils.isTeamUrl.mockImplementation((serverURL, parsedURL) => parsedURL.toString().startsWith(serverURL));
            WebContentsEvents.generateWillNavigate(jest.fn())(event, 'http://server-1.com/subpath');
            expect(event.preventDefault).not.toBeCalled();
        });

        it('should allow navigation when url isAdminURL', () => {
            urlUtils.isTeamUrl.mockImplementation((serverURL, parsedURL) => parsedURL.toString().startsWith(`${serverURL}/admin_console`));
            WebContentsEvents.generateWillNavigate(jest.fn())(event, 'http://server-1.com/admin_console/subpath');
            expect(event.preventDefault).not.toBeCalled();
        });

        // it('should allow navigation when isTrustedPopup', () => {
        //     const spy = jest.spyOn(WebContentsEvents, 'isTrustedPopupWindow');
        //     spy.mockReturnValue(false);
        //     WebContentsEvents.generateWillNavigate(jest.fn())(event, 'http://server-1.com/admin_console/subpath');
        //     expect(event.preventDefault).not.toBeCalled();
        // });

        it('should allow navigation when isCustomLoginURL', () => {
            urlUtils.isCustomLoginURL.mockImplementation((parsedURL, server) => parsedURL.toString().startsWith(`${server.url}/login`));
            WebContentsEvents.generateWillNavigate(jest.fn())(event, 'http://server-1.com/login/oauth');
            expect(event.preventDefault).not.toBeCalled();
        });

        it('should allow navigation when protocol is mailto', () => {
            WebContentsEvents.generateWillNavigate(jest.fn())(event, 'mailto:test@mattermost.com');
            expect(event.preventDefault).not.toBeCalled();
        });
        
        // it('should allow navigation when a custom login is in progress', () => {
            
        //     WebContentsEvents.generateWillNavigate(jest.fn())(event, 'http://anyoldurl.com');
        //     expect(event.preventDefault).not.toBeCalled();
        // });
    });
});
