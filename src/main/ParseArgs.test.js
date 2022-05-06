// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const dummyVersion = '1.2.3-test';

jest.mock('electron', () => ({
    app: {
        getVersion: () => dummyVersion,
    },
}));

import parse from 'main/ParseArgs';

describe('main/ParseArgs', () => {
    it('should remove arguments following a deeplink', () => {
        const args = parse(['mattermost', '--disableDevMode', 'mattermost://server-1.com']);
        expect(args.disableDevMode).toBe(true);
    });

    it('should show version and exit when specified', async () => {
        jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        parse(['mattermost', '--version', 'mattermost://server-1.com']);
        expect(exitSpy).toHaveBeenCalledWith(0);
        expect(logSpy).toHaveBeenCalledWith(dummyVersion);
    });
});
