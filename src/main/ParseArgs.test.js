// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import parse from 'main/ParseArgs';

describe('main/ParseArgs', () => {
    it('should remove arguments following a deeplink', () => {
        const args = parse(['mattermost', '--disableDevMode', 'mattermost://server-1.com', '--version']);
        expect(args.disableDevMode).toBe(true);
        expect(args.version).toBeUndefined();
    });
});
