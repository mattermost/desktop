// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getServerAPI} from './serverAPI';
import {ServerInfo} from './serverInfo';

jest.mock('./serverAPI', () => ({
    getServerAPI: jest.fn(),
}));

describe('main/server/serverInfo', () => {
    describe('getRemoteInfo', () => {
        const serverInfo = new ServerInfo({url: 'http://someurl.com'});
        const testData = {some: 'test'};
        const testString = JSON.stringify(testData);
        const callback = jest.fn();

        beforeEach(() => {
            getServerAPI.mockImplementation((url, auth, success) => {
                success(testString);
            });
        });

        afterEach(() => {
            callback.mockClear();
        });

        it('should return success callback when data is successfully parsed', async () => {
            await serverInfo.getRemoteInfo(callback, '/some/url');
            expect(callback).toHaveBeenCalledWith(testData);
        });

        it('should reject when URL is missing', async () => {
            await expect(serverInfo.getRemoteInfo(callback)).rejects.toThrow();
            expect(callback).not.toHaveBeenCalled();
        });

        it('should reject when JSON does not parse', async () => {
            getServerAPI.mockImplementation((url, auth, success) => {
                success('T^&V*RT^&*%BDF*H^(YTNB*&F&^TB(FC');
            });
            await expect(serverInfo.getRemoteInfo(callback)).rejects.toThrow();
            expect(callback).not.toHaveBeenCalled();
        });

        it('should reject when request fails', async () => {
            getServerAPI.mockImplementation((url, auth, success, abort, fail) => {
                fail();
            });
            await expect(serverInfo.getRemoteInfo(callback)).rejects.toThrow();
            expect(callback).not.toHaveBeenCalled();
        });
    });
});
