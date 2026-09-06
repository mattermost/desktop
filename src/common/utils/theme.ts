// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const rgbPattern = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/;
const rgbaPattern = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*((?:\d+(?:\.\d+)?|\.\d+))\s*\)$/;
const hexPattern = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function parseThemeColor(color: string) {
    const rgb = rgbPattern.exec(color) ?? rgbaPattern.exec(color);
    if (rgb) {
        const components = rgb.slice(1, 4).map((component) => parseInt(component, 10));
        const alpha = rgb[4] === undefined ? 1 : parseFloat(rgb[4]);
        if (components.some((component) => component > 255) || alpha > 1) {
            return undefined;
        }
        return {
            red: components[0],
            green: components[1],
            blue: components[2],
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
