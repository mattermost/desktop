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

        it('should pass the provided session along with the request', async () => {
            const requestSession = {id: 'validation-session'};

            await serverInfo.pingServer(requestSession);
            expect(getServerAPI).toHaveBeenLastCalledWith(
                expect.anything(),
                false,
                expect.any(Function),
                expect.any(Function),
                expect.any(Function),
                requestSession,
            );

            await serverInfo.fetchConfigData(requestSession);
            expect(getServerAPI).toHaveBeenLastCalledWith(
                expect.anything(),
                false,
                expect.any(Function),
                expect.any(Function),
                expect.any(Function),
                requestSession,
            );
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

        it('should not fetch session attributes manifest if session attributes are not enabled', async () => {
            getServerAPI.mockImplementation((url, auth, success) => {
                if (url.toString() === 'http://someurl.com/api/v4/config/client?format=old') {
                    success(JSON.stringify({FeatureFlagSessionAttributes: 'false'}));
                } else if (url.toString() === 'http://someurl.com/api/v4/users/sessions/attributes/manifest') {
                    success(JSON.stringify([{name: 'test', type: 'string', ttl_seconds: 30, grace_period_seconds: 60, platforms: ['desktop']}]));
                } else if (url.toString() === 'http://someurl.com/api/v4/plugins/webapp') {
                    success(JSON.stringify([]));
                } else if (url.toString() === 'http://someurl.com/api/v4/license/client?format=old') {
                    success(JSON.stringify({SkuShortName: 'professional'}));
                } else {
                    success(JSON.stringify({}));
                }
            });
            await serverInfo.fetchRemoteInfo();
            expect(serverInfo.remoteInfo.sessionAttributesManifest).toBeUndefined();
        });

        const mockServer = ({featureFlag, sku, manifest}) => {
            getServerAPI.mockImplementation((url, auth, success) => {
                if (url.toString() === 'http://someurl.com/api/v4/config/client?format=old') {
                    success(JSON.stringify({FeatureFlagSessionAttributes: featureFlag}));
                } else if (url.toString() === 'http://someurl.com/api/v4/users/sessions/attributes/manifest') {
                    success(JSON.stringify(manifest));
                } else if (url.toString() === 'http://someurl.com/api/v4/plugins/webapp') {
                    success(JSON.stringify([]));
                } else if (url.toString() === 'http://someurl.com/api/v4/license/client?format=old') {
                    success(JSON.stringify({SkuShortName: sku}));
                } else {
                    success(JSON.stringify({}));
                }
            });
        };
        const manifestURL = 'http://someurl.com/api/v4/users/sessions/attributes/manifest';
        const manifestRequested = () => getServerAPI.mock.calls.some(([url]) => url.toString() === manifestURL);
        const manifest = [{name: 'test', type: 'string', ttl_seconds: 30, grace_period_seconds: 60, platforms: ['desktop']}];

        it.each(['advanced', 'entry'])('should fetch and store the session attributes manifest when session attributes are enabled on a %s license', async (sku) => {
            const info = new ServerInfo({url: 'http://someurl.com'});
            getServerAPI.mockClear();
            mockServer({featureFlag: 'true', sku, manifest});
            await info.fetchRemoteInfo();
            expect(manifestRequested()).toBe(true);
            expect(info.remoteInfo.sessionAttributesEnabled).toBe(true);
            expect(info.remoteInfo.sessionAttributesManifest).toEqual(manifest);
        });

        it.each(['professional', 'enterprise', '', undefined])('should not request the session attributes manifest when the feature flag is on but the license is %p', async (sku) => {
            const info = new ServerInfo({url: 'http://someurl.com'});
            getServerAPI.mockClear();
            mockServer({featureFlag: 'true', sku, manifest});
            await info.fetchRemoteInfo();
            expect(manifestRequested()).toBe(false);
            expect(info.remoteInfo.sessionAttributesEnabled).toBe(false);
            expect(info.remoteInfo.sessionAttributesManifest).toBeUndefined();
        });
    });
});
