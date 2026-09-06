// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {parseThemeColor} from './theme';

describe('parseThemeColor', () => {
    it.each([
        ['#123456', {red: 18, green: 52, blue: 86}],
        ['123456', {red: 18, green: 52, blue: 86}],
        ['#abc', {red: 170, green: 187, blue: 204}],
        ['rgb(18,52,86)', {red: 18, green: 52, blue: 86}],
        ['rgba(18,52,86,0.5)', {red: 18, green: 52, blue: 86}],
    ])('parses %s', (color, expected) => {
        expect(parseThemeColor(color)).toEqual(expected);
    });

    it.each(['', 'red', '#12', 'rgb(1,2)', 'rgba(1,2,3,bad)'])('rejects %s', (color) => {
        expect(parseThemeColor(color)).toBeUndefined();
    });
});
