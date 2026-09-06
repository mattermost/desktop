// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const rgbPattern = /^rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)$/;
const hexPattern = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function parseThemeColor(color: string) {
    const rgb = rgbPattern.exec(color);
    if (rgb) {
        return {
            red: parseInt(rgb[1], 10),
            green: parseInt(rgb[2], 10),
            blue: parseInt(rgb[3], 10),
        };
    }

    const hex = hexPattern.exec(color)?.[1];
    if (!hex) {
        return undefined;
    }
    const normalized = hex.length === 3 ? [...hex].map((component) => component.repeat(2)).join('') : hex;
    return {
        red: parseInt(normalized.slice(0, 2), 16),
        green: parseInt(normalized.slice(2, 4), 16),
        blue: parseInt(normalized.slice(4, 6), 16),
    };
}
