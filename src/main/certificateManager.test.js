// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {CertificateManager} from 'main/certificateManager';
import ModalManager from 'main/views/modalManager';
import MainWindow from 'main/windows/mainWindow';

jest.mock('main/windows/mainWindow', () => ({
    get: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('main/views/modalManager', () => ({
    addModal: jest.fn(),
}));

jest.mock('main/utils', () => ({
    getLocalPreload: (file) => file,
}));

describe('main/certificateManager', () => {
    describe('handleSelectCertificate', () => {
        const certificateManager = new CertificateManager();
        certificateManager.popCertificateModal = jest.fn();

        it('should not pop modal on no certificates', () => {
            certificateManager.handleSelectCertificate({preventDefault: jest.fn()}, null, 'http://someurl.com/', [], jest.fn());
            expect(certificateManager.popCertificateModal).not.toBeCalled();
        });

        it('should not pop modal on one certificate', () => {
            certificateManager.handleSelectCertificate({preventDefault: jest.fn()}, null, 'http://someurl.com/', [{}], jest.fn());
            expect(certificateManager.popCertificateModal).not.toBeCalled();
        });

        it('should pop modal on two certificates', () => {
            certificateManager.handleSelectCertificate({preventDefault: jest.fn()}, null, 'http://someurl.com/', [{}, {}], jest.fn());
            expect(certificateManager.popCertificateModal).toBeCalled();
        });

        it('should set callback when checking for cert', () => {
            const callback = jest.fn();
            certificateManager.handleSelectCertificate({preventDefault: jest.fn()}, null, 'http://someurl.com/', [{}, {}], callback);
            expect(certificateManager.certificateRequestCallbackMap.get('http://someurl.com/')).toEqual(callback);
        });
    });

    describe('popCertificateModal', () => {
        const certificateManager = new CertificateManager();

        it('should not pop modal when no main window exists', () => {
            MainWindow.get.mockImplementationOnce(() => null);
            certificateManager.popCertificateModal('http://anormalurl.com', [{data: 'test 1'}, {data: 'test 2'}, {data: 'test 3'}]);
            expect(ModalManager.addModal).not.toBeCalled();
        });

        it('should return the chosen certificate when modal resolves', async () => {
            certificateManager.handleSelectedCertificate = jest.fn();
            const promise = Promise.resolve({cert: {data: 'test 2'}});
            ModalManager.addModal.mockImplementationOnce(() => promise);
            certificateManager.popCertificateModal('http://anormalurl.com', [{data: 'test 1'}, {data: 'test 2'}, {data: 'test 3'}]);
            await promise;
            expect(certificateManager.handleSelectedCertificate).toBeCalledWith('http://anormalurl.com', {data: 'test 2'});
        });

        it('should call with no cert when modal rejects', async () => {
            certificateManager.handleSelectCertificate = jest.fn();
            const error = new Error('oops');
            const promise = Promise.reject(error);
            ModalManager.addModal.mockImplementationOnce(() => promise);
            certificateManager.popCertificateModal('http://anormalurl.com', [{data: 'test 1'}, {data: 'test 2'}, {data: 'test 3'}]);
            await expect(promise).rejects.toThrow(error);
            expect(certificateManager.handleSelectedCertificate).toBeCalledWith('http://anormalurl.com');
        });
    });

    describe('handleSelectedCertificate', () => {
        const certificateManager = new CertificateManager();
        const callback = jest.fn();

        beforeEach(() => {
            certificateManager.certificateRequestCallbackMap.set('http://someurl.com', callback);
        });

        it('should fire callback on successful selection', () => {
            certificateManager.handleSelectedCertificate('http://someurl.com', {data: 'test'});
            expect(callback).toBeCalledWith({data: 'test'});
            expect(certificateManager.certificateRequestCallbackMap.get('http://someurl.com')).toBe(undefined);
        });

        it('should fail gracefully on no callback found', () => {
            certificateManager.handleSelectedCertificate('http://someotherurl.com', {data: 'test'});
            expect(callback).not.toBeCalled();
            expect(certificateManager.certificateRequestCallbackMap.get('http://someurl.com')).toBe(callback);
        });

        it('should fail gracefully on no certificate', () => {
            certificateManager.handleSelectedCertificate('http://someurl.com');
            expect(callback).not.toBeCalled();
            expect(certificateManager.certificateRequestCallbackMap.get('http://someurl.com')).toBe(undefined);
        });
    });
});
