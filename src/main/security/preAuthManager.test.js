// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import MainWindow from 'app/mainWindow/mainWindow';
import ModalManager from 'app/mainWindow/modals/modalManager';
import ServerManager from 'common/servers/serverManager';
import {PreAuthManager} from 'main/security/preAuthManager';

jest.mock('common/utils/url', () => {
    const actualUrl = jest.requireActual('common/utils/url');
    return {
        ...actualUrl,
        parseURL: (url) => new URL(url),
        isTrustedURL: () => true,
    };
});

jest.mock('electron', () => ({
    app: {
        getPath: jest.fn(),
        on: jest.fn(),
    },
    ipcMain: {
        on: jest.fn(),
    },
}));

jest.mock('app/mainWindow/mainWindow', () => ({
    get: jest.fn().mockImplementation(() => ({})),
    on: jest.fn(),
}));

jest.mock('common/views/viewManager', () => ({
    getViewByWebContentsId: jest.fn(),
}));

jest.mock('app/mainWindow/modals/modalManager', () => ({
    addModal: jest.fn(),
}));

jest.mock('common/servers/serverManager', () => ({
    lookupServerByURL: jest.fn(),
    on: jest.fn(),
}));

jest.mock('main/utils', () => ({
    getLocalPreload: (file) => file,
}));

jest.mock('app/mainWindow/mainWindow', () => ({
    get: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('app/mainWindow/modals/modalManager', () => ({
    addModal: jest.fn(),
}));

jest.mock('main/utils', () => ({
    getLocalPreload: (file) => file,
}));

jest.mock('main/secureStorage', () => ({
    setSecret: jest.fn(),
}));

describe('main/preAuthManager', () => {
    describe('handleClientCert', () => {
        const preAuthManager = new PreAuthManager();

        it('should not pop modal on no certificates', () => {
            const callback = jest.fn();
            preAuthManager.handleClientCert({preventDefault: jest.fn()}, null, 'http://someurl.com/', [], callback);
            expect(ModalManager.addModal).not.toBeCalled();
            expect(callback).not.toBeCalled();
        });

        it('should not pop modal on one certificate', () => {
            const callback = jest.fn();
            preAuthManager.handleClientCert({preventDefault: jest.fn()}, null, 'http://someurl.com/', [{}], callback);
            expect(ModalManager.addModal).not.toBeCalled();
            expect(callback).not.toBeCalled();
        });

        it('should pop modal on two certificates', () => {
            ServerManager.lookupServerByURL.mockReturnValue({id: 'test-view', url: new URL('http://someurl.com/')});
            const callback = jest.fn();
            preAuthManager.handleClientCert({preventDefault: jest.fn()}, null, 'http://someurl.com/', [{}, {}], callback);
            expect(ModalManager.addModal).toBeCalled();
        });

        it('should not pop modal when no main window exists', () => {
            MainWindow.get.mockImplementationOnce(() => null);
            const callback = jest.fn();
            preAuthManager.handleClientCert({preventDefault: jest.fn()}, null, 'http://anormalurl.com/', [{data: 'test 1'}, {data: 'test 2'}, {data: 'test 3'}], callback);
            expect(ModalManager.addModal).not.toBeCalled();
            expect(callback).not.toBeCalled();
        });

        it('should return the chosen certificate when modal resolves', async () => {
            ServerManager.lookupServerByURL.mockReturnValue({id: 'test-view', url: new URL('http://anormalurl.com/')});
            const callback = jest.fn();
            const promise = Promise.resolve({cert: {data: 'test 2'}});
            ModalManager.addModal.mockImplementationOnce(() => promise);
            preAuthManager.handleClientCert({preventDefault: jest.fn()}, null, 'http://anormalurl.com/', [{data: 'test 1'}, {data: 'test 2'}, {data: 'test 3'}], callback);
            await promise;
            expect(callback).toBeCalledWith({data: 'test 2'});
        });

        it('should call with no cert when modal rejects', async () => {
            ServerManager.lookupServerByURL.mockReturnValue({id: 'test-view', url: new URL('http://anormalurl.com/')});
            const callback = jest.fn();
            const error = new Error('oops');
            ModalManager.addModal.mockImplementationOnce(() => Promise.reject(error));
            preAuthManager.handleClientCert({preventDefault: jest.fn()}, null, 'http://anormalurl.com/', [{data: 'test 1'}, {data: 'test 2'}, {data: 'test 3'}], callback);

            // Wait for the promise to resolve/reject
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(callback).toBeCalledWith();
        });

        it('should handle domain:443 format URLs for certificate selection', () => {
            ServerManager.lookupServerByURL.mockReturnValue({id: 'test-view', url: new URL('https://trustedurl.com')});
            const callback = jest.fn();
            preAuthManager.handleClientCert({preventDefault: jest.fn()}, null, 'trustedurl.com:443', [{}, {}], callback);
            expect(ModalManager.addModal).toBeCalled();
        });

        it('should handle domain:80 format URLs for certificate selection', () => {
            ServerManager.lookupServerByURL.mockReturnValue({id: 'test-view', url: new URL('http://trustedurl.com')});
            const callback = jest.fn();
            preAuthManager.handleClientCert({preventDefault: jest.fn()}, null, 'trustedurl.com:80', [{}, {}], callback);
            expect(ModalManager.addModal).toBeCalled();
        });

        it('should handle other port numbers with https', () => {
            ServerManager.lookupServerByURL.mockReturnValue({id: 'test-view', url: new URL('https://trustedurl.com:8080')});
            const callback = jest.fn();
            preAuthManager.handleClientCert({preventDefault: jest.fn()}, null, 'trustedurl.com:8080', [{}, {}], callback);
            expect(ModalManager.addModal).toBeCalled();
        });

        it('should not pop modal for untrusted domain:port format URLs', () => {
            ServerManager.lookupServerByURL.mockReturnValue(undefined);
            const callback = jest.fn();
            preAuthManager.handleClientCert({preventDefault: jest.fn()}, null, 'untrusted.com:8080', [{}, {}], callback);
            expect(ModalManager.addModal).not.toBeCalled();
            expect(callback).not.toBeCalled();
        });
    });

    describe('handlePreAuthSecret', () => {
        const preAuthManager = new PreAuthManager();

        it('should not pop modal on untrusted URL', () => {
            const callback = jest.fn();
            preAuthManager.handlePreAuthSecret('http://untrustedurl.com/', callback);
            expect(ModalManager.addModal).not.toBeCalled();
            expect(callback).not.toBeCalled();
        });

        it('should pop modal on trusted URL', () => {
            ServerManager.lookupServerByURL.mockReturnValue({id: 'test-view', url: new URL('http://trustedurl.com/')});
            const callback = jest.fn();
            preAuthManager.handlePreAuthSecret('http://trustedurl.com/', callback);
            expect(ModalManager.addModal).toBeCalled();
        });

        it('should not pop modal when no main window exists', () => {
            ServerManager.lookupServerByURL.mockReturnValue({id: 'test-view', url: new URL('http://trustedurl.com/')});
            MainWindow.get.mockImplementationOnce(() => null);
            const callback = jest.fn();
            preAuthManager.handlePreAuthSecret('http://trustedurl.com/', callback);
            expect(ModalManager.addModal).not.toBeCalled();
            expect(callback).not.toBeCalled();
        });

        it('should return secret when modal resolves', async () => {
            ServerManager.lookupServerByURL.mockReturnValue({id: 'test-view', url: new URL('http://trustedurl.com/')});
            const callback = jest.fn();
            const promise = Promise.resolve('secret123');
            ModalManager.addModal.mockImplementationOnce(() => promise);
            preAuthManager.handlePreAuthSecret('http://trustedurl.com/', callback);
            await promise;
            expect(callback).toBeCalledWith('secret123');
        });

        it('should call with no secret when modal rejects', async () => {
            ServerManager.lookupServerByURL.mockReturnValue({id: 'test-view', url: new URL('http://trustedurl.com/')});
            const callback = jest.fn();
            const error = new Error('oops');
            ModalManager.addModal.mockImplementationOnce(() => Promise.reject(error));
            preAuthManager.handlePreAuthSecret('http://trustedurl.com/', callback);

            // Wait for the promise to resolve/reject
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(callback).toBeCalledWith();
        });
    });

    describe('handleBasicAuth', () => {
        const preAuthManager = new PreAuthManager();

        beforeEach(() => {
            MainWindow.get.mockImplementation(() => ({}));
        });

        it('should not pop any modal on a missing server', () => {
            ServerManager.lookupServerByURL.mockReturnValue(undefined);
            const callback = jest.fn();
            preAuthManager.handleBasicAuth({preventDefault: jest.fn()}, {id: 0}, {url: 'http://badurl.com/'}, {isProxy: false, host: 'badurl'}, callback);
            expect(ModalManager.addModal).not.toBeCalled();
            expect(callback).not.toBeCalled();
        });

        it('should popLoginModal when isTrustedURL', () => {
            ServerManager.lookupServerByURL.mockReturnValue({id: 'test-view', url: new URL('http://trustedurl.com/')});
            const callback = jest.fn();
            preAuthManager.handleBasicAuth({preventDefault: jest.fn()}, {id: 1}, {url: 'http://trustedurl.com/'}, {isProxy: false, host: 'trustedurl'}, callback);
            expect(ModalManager.addModal).toBeCalled();
        });

        it('should not pop modal when no main window exists', () => {
            MainWindow.get.mockImplementation(() => null);
            const callback = jest.fn();
            preAuthManager.handleBasicAuth({preventDefault: jest.fn()}, {id: 1}, {url: 'http://trustedurl.com'}, {
                isProxy: false,
                host: 'anormalurl',
            }, callback);
            expect(ModalManager.addModal).not.toBeCalled();
            expect(callback).not.toBeCalled();
        });

        it('should call with prefix based on proxy setting', () => {
            const callback = jest.fn();

            // Test proxy case
            ServerManager.lookupServerByURL.mockReturnValue({id: 'test-view', url: new URL('http://trustedurl.com/')});
            preAuthManager.handleBasicAuth({preventDefault: jest.fn()}, {id: 1}, {url: 'http://trustedurl.com/'},
                {
                    isProxy: true,
                    host: 'anormalurl',
                }, callback);
            expect(ModalManager.addModal).toBeCalledWith(
                'proxyLoginModal-anormalurl',
                expect.any(String),
                expect.any(String),
                expect.any(Object),
                expect.any(Object),
            );

            // Reset the mock and test non-proxy case
            ModalManager.addModal.mockClear();
            preAuthManager.handleBasicAuth({preventDefault: jest.fn()}, {id: 1}, {url: 'http://trustedurl.com/'},
                {
                    isProxy: false,
                    host: 'anormalurl',
                }, callback);
            expect(ModalManager.addModal).toBeCalledWith(
                'loginModal-http://trustedurl.com/',
                expect.any(String),
                expect.any(String),
                expect.any(Object),
                expect.any(Object),
            );
        });

        it('should return login credentials when modal resolves', async () => {
            ServerManager.lookupServerByURL.mockImplementation((parsedURL) => {
                if (parsedURL && parsedURL.toString() === 'http://trustedurl.com/') {
                    return {id: 'test-view', url: new URL('http://trustedurl.com/')};
                }
                return undefined;
            });
            const callback = jest.fn();
            const promise = Promise.resolve({username: 'test', password: 'password'});
            ModalManager.addModal.mockImplementationOnce(() => promise);
            preAuthManager.handleBasicAuth({preventDefault: jest.fn()}, {id: 1}, {url: 'http://trustedurl.com/'},
                {
                    isProxy: true,
                    host: 'differenthost',
                }, callback);
            await promise;
            expect(callback).toBeCalledWith('test', 'password');
        });

        it('should cancel the login event when modal rejects', async () => {
            ServerManager.lookupServerByURL.mockImplementation((parsedURL) => {
                if (parsedURL && parsedURL.toString() === 'http://differenturl.com/') {
                    return {id: 'test-view', url: new URL('http://differenturl.com/')};
                }
                return undefined;
            });
            const callback = jest.fn();
            const error = new Error('oops');
            const promise = Promise.reject(error);
            ModalManager.addModal.mockImplementationOnce(() => promise);
            preAuthManager.handleBasicAuth({preventDefault: jest.fn()}, {id: 1}, {url: 'http://differenturl.com/'},
                {
                    isProxy: false,
                    host: 'anormalurl',
                }, callback);

            // Wait for the promise to resolve/reject
            await expect(promise).rejects.toThrow(error);
            expect(callback).toBeCalledWith();
        });
    });
});
