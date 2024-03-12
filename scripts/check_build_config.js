// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
const buildConfig = require('../dist/common/config/buildConfig').default;

function validateBuildConfig(config) {
    if (config.enableServerManagement === false && config.defaultServers && config.defaultServers.length === 0) {
        return {
            result: false,
            message: `Specify at least one server for "defaultServers" in buildConfig.js when "enableServerManagement is set to false.\n${JSON.stringify(config, null, 2)}`,
        };
    }
    return {result: true};
}

const ret = validateBuildConfig(buildConfig);
if (ret.result === false) {
    throw new Error(ret.message);
}
