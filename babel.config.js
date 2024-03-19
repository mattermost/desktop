// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

module.exports = (api) => {
    api.cache.forever();
    return {
        presets: [
            ['@babel/preset-env', {
                targets: {
                    browsers: ['Electron >= 29.0'],
                    node: '20.9',
                },
            }],
            '@babel/preset-react',
            ['@babel/typescript', {
                allExtensions: true,
                isTSX: true,
            }],
        ],
        plugins: [
            '@babel/plugin-transform-object-rest-spread',
            '@babel/plugin-transform-class-properties',
            '@babel/plugin-transform-private-methods',
        ],
    };
};
