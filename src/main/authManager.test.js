// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {AuthManager} from 'main/authManager';
import ModalManager from 'main/views/modalManager';
import ViewManager from 'main/views/viewManager';
import MainWindow from 'main/windows/mainWindow';

jest.mock('common/utils/url', () => {
    const actualUrl = jest.requireActual('common/utils/url');
    return {
        ...actualUrl,
        isTrustedURL: (url) => {
            return url.toString() === 'http://trustedurl.com/';
        },
    };
});

jest.mock('electron', () => ({
    app: {
        getPath: jest.fn(),
    },
    ipcMain: {
        on: jest.fn(),
    },
}));

jest.mock('main/trustedOrigins', () => ({
    addPermission: jest.fn(),
    checkPermission: (url) => {
        return url.toString() === 'http://haspermissionurl.com/';
    },
    save: jest.fn(),
}));

jest.mock('main/windows/mainWindow', () => ({
    get: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('main/views/viewManager', () => ({
    getViewByWebContentsId: jest.fn(),
}));

jest.mock('main/views/modalManager', () => ({
    addModal: jest.fn(),
}));

jest.mock('main/utils', () => ({
    getLocalPreload: (file) => file,
}));

describe('main/authManager', () => {
    describe('handleAppLogin', () => {
        const authManager = new AuthManager();
        authManager.popLoginModal = jest.fn();
        authManager.popPermissionModal = jest.fn();

        it('should not pop any modal on a missing server', () => {
            ViewManager.getViewByWebContentsId.mockReturnValue(undefined);
            authManager.handleAppLogin({preventDefault: jest.fn()}, {id: 0}, {url: 'http://badurl.com/'}, null, jest.fn());
            expect(authManager.popLoginModal).not.toBeCalled();
            expect(authManager.popPermissionModal).not.toBeCalled();
        });

        it('should popLoginModal when isTrustedURL', () => {
            ViewManager.getViewByWebContentsId.mockReturnValue({view: {server: {url: new URL('http://trustedurl.com/')}}});
            authManager.handleAppLogin({preventDefault: jest.fn()}, {id: 1}, {url: 'http://trustedurl.com/'}, null, jest.fn());
            expect(authManager.popLoginModal).toBeCalled();
            expect(authManager.popPermissionModal).not.toBeCalled();
        });

        it('should popLoginModal when has permission', () => {
            ViewManager.getViewByWebContentsId.mockReturnValue({view: {server: {url: new URL('http://haspermissionurl.com/')}}});
            authManager.handleAppLogin({preventDefault: jest.fn()}, {id: 1}, {url: 'http://haspermissionurl.com/'}, null, jest.fn());
            expect(authManager.popLoginModal).toBeCalled();
            expect(authManager.popPermissionModal).not.toBeCalled();
        });

        it('should popPermissionModal when anything else is true', () => {
            ViewManager.getViewByWebContentsId.mockReturnValue({view: {server: {url: new URL('http://someotherurl.com/')}}});
            authManager.handleAppLogin({preventDefault: jest.fn()}, {id: 1}, {url: 'http://someotherurl.com/'}, null, jest.fn());
            expect(authManager.popLoginModal).not.toBeCalled();
            expect(authManager.popPermissionModal).toBeCalled();
        });

        it('should set login callback when logging in', () => {
            ViewManager.getViewByWebContentsId.mockReturnValue({view: {server: {url: new URL('http://someotherurl.com/')}}});
            const callback = jest.fn();
            authManager.handleAppLogin({preventDefault: jest.fn()}, {id: 1}, {url: 'http://someotherurl.com/'}, null, callback);
            expect(authManager.loginCallbackMap.get('http://someotherurl.com/')).toEqual(callback);
        });
    });

    describe('popLoginModal', () => {
        const authManager = new AuthManager();

        it('should not pop modal when no main window exists', () => {
            MainWindow.get.mockImplementationOnce(() => null);
            authManager.popLoginModal({url: 'http://anormalurl.com'}, {
                isProxy: false,
                host: 'anormalurl',
            });
            expect(ModalManager.addModal).not.toBeCalled();
        });

        it('should call with prefix based on proxy setting', () => {
            authManager.popLoginModal({url: 'http://anormalurl.com'},
                {
                    isProxy: true,
                    host: 'anormalurl',
                });
            expect(ModalManager.addModal).toBeCalledWith(
                'proxyLoginModal-anormalurl',
                expect.any(String),
                expect.any(String),
                expect.any(Object),
                expect.any(Object),
            );

            authManager.popLoginModal({url: 'http://anormalurl.com'},
                {
                    isProxy: false,
                    host: 'anormalurl',
                });
            expect(ModalManager.addModal).toBeCalledWith(
                'loginModal-http://anormalurl.com',
                expect.any(String),
                expect.any(String),
                expect.any(Object),
                expect.any(Object),
            );
        });

        it('should return login credentials when modal resolves', async () => {
            authManager.handleLoginCredentialsEvent = jest.fn();
            const promise = Promise.resolve({username: 'test', password: 'password'});
            ModalManager.addModal.mockImplementationOnce(() => promise);
            authManager.popLoginModal({url: 'http://anormalurl.com'},
                {
                    isProxy: false,
                    host: 'anormalurl',
                });
            await promise;
            expect(authManager.handleLoginCredentialsEvent).toBeCalledWith({url: 'http://anormalurl.com'}, 'test', 'password');
        });

        it('should cancel the login event when modal rejects', async () => {
            authManager.handleCancelLoginEvent = jest.fn();
            const error = new Error('oops');
            const promise = Promise.reject(error);
            ModalManager.addModal.mockImplementationOnce(() => promise);
            authManager.popLoginModal({url: 'http://anormalurl.com'},
                {
                    isProxy: false,
                    host: 'anormalurl',
                });
            await expect(promise).rejects.toThrow(error);
            expect(authManager.handleCancelLoginEvent).toBeCalledWith({url: 'http://anormalurl.com'});
        });
    });

    describe('popPermissionModal', () => {
        const authManager = new AuthManager();

        it('should not pop modal when no main window exists', () => {
            MainWindow.get.mockImplementationOnce(() => null);
            authManager.popPermissionModal({url: 'http://anormalurl.com'}, {
                isProxy: false,
                host: 'anormalurl',
            }, 'canBasicAuth');
            expect(ModalManager.addModal).not.toBeCalled();
        });

        it('should call the login event when modal resolves', async () => {
            authManager.popLoginModal = jest.fn();
            authManager.handlePermissionGranted = jest.fn();
            const promise = Promise.resolve();
            ModalManager.addModal.mockImplementationOnce(() => promise);
            authManager.popPermissionModal({url: 'http://anormalurl.com'},
                {
                    isProxy: false,
                    host: 'anormalurl',
                }, 'canBasicAuth');
            await promise;
            expect(authManager.handlePermissionGranted).toBeCalledWith('http://anormalurl.com', 'canBasicAuth');
            expect(authManager.popLoginModal).toBeCalledWith({url: 'http://anormalurl.com'}, {
                isProxy: false,
                host: 'anormalurl',
            });
        });

        it('should cancel the login event when modal rejects', async () => {
            authManager.handleCancelLoginEvent = jest.fn();
            const error = new Error('oops');
            const promise = Promise.reject(error);
            ModalManager.addModal.mockImplementationOnce(() => promise);
            authManager.popPermissionModal({url: 'http://anormalurl.com'},
                {
                    isProxy: false,
                    host: 'anormalurl',
                }, 'canBasicAuth');
            await expect(promise).rejects.toThrow(error);
            expect(authManager.handleCancelLoginEvent).toBeCalledWith({url: 'http://anormalurl.com'});
        });
    });

    describe('handleLoginCredentialsEvent', () => {
        const authManager = new AuthManager();
        const callback = jest.fn();

        beforeEach(() => {
            authManager.loginCallbackMap.set('http://someurl.com', callback);
        });

        it('should fire callback on successful login', () => {
            authManager.handleLoginCredentialsEvent({url: 'http://someurl.com'}, 'test', 'password');
            expect(callback).toBeCalledWith('test', 'password');
            expect(authManager.loginCallbackMap.get('http://someurl.com')).toBe(undefined);
        });

        it('should fail gracefully on no callback found', () => {
            authManager.handleLoginCredentialsEvent({url: 'http://someotherurl.com'}, 'test', 'password');
            expect(callback).not.toBeCalled();
            expect(authManager.loginCallbackMap.get('http://someurl.com')).toBe(callback);
        });
    });
});
