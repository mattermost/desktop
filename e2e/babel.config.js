// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

module.exports = (api) => {
    api.cache.forever();
    return {
        presets: [
            '@babel/typescript',
        ],
    };
};
