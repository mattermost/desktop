// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

module.exports = (api) => { // eslint-disable-line import/no-commonjs
    api.cache.forever();
    return {
        presets: [
            ['@babel/preset-env', {
                targets: {
                    browsers: ['Electron >= 2.0'],
                    node: '8.9',
                },
            }],
            '@babel/preset-react',
        ],
        plugins: ['@babel/plugin-proposal-object-rest-spread', '@babel/plugin-proposal-class-properties'],
    };
};
