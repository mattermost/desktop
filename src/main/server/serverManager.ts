// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Config from 'common/config';

export class ServerManager {
    init = () => {
        //Config.teams
    }

    getServer = (name: string) => {
        return Config.teams.find((team) => team.name === name);
    }

    getAllServers = () => {
        return Config.teams;
    }

    hasServers = () => {
        return Boolean(Config.teams.length);
    }
}

const serverManager = new ServerManager();
export default serverManager;
