// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {createTemplate} from './tray';

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));

jest.mock('main/windows/windowManager', () => ({}));

describe('main/menus/tray', () => {
    it('should show the first 9 servers (using order)', () => {
        const config = {
            teams: [...Array(15).keys()].map((key) => ({
                name: `server-${key}`,
                url: `http://server-${key}.com`,
                order: (key + 5) % 15,
                lastActiveTab: 0,
                tab: [
                    {
                        name: 'TAB_MESSAGING',
                        isOpen: true,
                    },
                ],
            })),
        };
        const menu = createTemplate(config);
        for (let i = 10; i < 15; i++) {
            const menuItem = menu.find((item) => item.label === `server-${i}`);
            expect(menuItem).not.toBe(undefined);
        }
        for (let i = 0; i < 4; i++) {
            const menuItem = menu.find((item) => item.label === `server-${i}`);
            expect(menuItem).not.toBe(undefined);
        }
        for (let i = 4; i < 10; i++) {
            const menuItem = menu.find((item) => item.label === `server-${i}`);
            expect(menuItem).toBe(undefined);
        }
    });
});
