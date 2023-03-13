// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import log from 'electron-log';

import {Team, TeamWithTabs} from 'types/config';
import {RemoteInfo} from 'types/server';

import Config from 'common/config';
import {MattermostServer} from 'common/servers/MattermostServer';
import {TAB_FOCALBOARD, TAB_MESSAGING, TAB_PLAYBOOKS, getDefaultTeamWithTabsFromTeam} from 'common/tabs/TabView';
import Utils from 'common/utils/util';

import {ServerInfo} from 'main/server/serverInfo';

export class ServerManager {
    init = () => {
        this.updateServerInfos(this.getAllServers());
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

    addServer = (server: Team) => {
        const teams = this.getAllServers();
        const order = teams.length;
        const newTeam = getDefaultTeamWithTabsFromTeam({...server, order});
        teams.push(newTeam);
        Config.set('teams', teams);
        this.updateServerInfos([newTeam]);
        return newTeam;
    }

    editServer = (server: Team, index: number) => {
        const teams = this.getAllServers();
        teams[index].name = server.name;
        teams[index].url = server.url;
        Config.set('teams', teams);
        this.updateServerInfos([teams[index]]);
    }

    removeServer = (serverName: string) => {
        const teams = this.getAllServers();
        const removedTeam = teams.findIndex((team) => team.name === serverName);
        if (removedTeam < 0) {
            return;
        }
        const removedOrder = teams[removedTeam].order;
        teams.splice(removedTeam, 1);
        teams.forEach((value) => {
            if (value.order > removedOrder) {
                value.order--;
            }
        });
        Config.set('teams', teams);
    }

    toggleTab = (serverName: string, tabName: string, isOpen: boolean) => {
        const teams = this.getAllServers();
        teams.forEach((team) => {
            if (team.name === serverName) {
                team.tabs.forEach((tab) => {
                    if (tab.name === tabName) {
                        tab.isOpen = isOpen;
                    }
                });
            }
        });
        Config.set('teams', teams);
    }

    updateLastActive = (serverName: string, tabName: string) => {
        const teams = this.getAllServers();
        teams.forEach((team) => {
            if (team.name === serverName) {
                const viewOrder = team?.tabs.find((tab) => tab.name === tabName)?.order || 0;
                team.lastActiveTab = viewOrder;
            }
        });
        Config.setMultiple({
            teams,
            lastActiveTeam: teams.find((team) => team.name === serverName)?.order || 0,
        });
    }

    updateServerInfos = (teams: TeamWithTabs[]) => {
        log.silly('app.utils.updateServerInfos');
        const serverInfos: Array<Promise<RemoteInfo | string | undefined>> = [];
        teams.forEach((team) => {
            const serverInfo = new ServerInfo(new MattermostServer(team.name, team.url));
            serverInfos.push(serverInfo.promise);
        });
        Promise.all(serverInfos).then((data: Array<RemoteInfo | string | undefined>) => {
            const teams = this.getAllServers();
            let hasUpdates = false;
            teams.forEach((team) => {
                hasUpdates = hasUpdates || this.updateServerURL(data, team);
                hasUpdates = hasUpdates || this.openExtraTabs(data, team);
            });
            if (hasUpdates) {
                Config.set('teams', teams);
            }
        }).catch((reason: any) => {
            log.error('Error getting server infos', reason);
        });
    }

    private updateServerURL = (data: Array<RemoteInfo | string | undefined>, team: TeamWithTabs) => {
        const remoteInfo = data.find((info) => info && typeof info !== 'string' && info.name === team.name) as RemoteInfo;
        if (remoteInfo && remoteInfo.siteURL && team.url !== remoteInfo.siteURL) {
            team.url = remoteInfo.siteURL;
            return true;
        }
        return false;
    }

    private openExtraTabs = (data: Array<RemoteInfo | string | undefined>, team: TeamWithTabs) => {
        let hasUpdates = false;
        const remoteInfo = data.find((info) => info && typeof info !== 'string' && info.name === team.name) as RemoteInfo;
        if (remoteInfo) {
            team.tabs.forEach((tab) => {
                if (tab.name !== TAB_MESSAGING && remoteInfo.serverVersion && Utils.isVersionGreaterThanOrEqualTo(remoteInfo.serverVersion, '6.0.0')) {
                    if (tab.name === TAB_PLAYBOOKS && remoteInfo.hasPlaybooks && typeof tab.isOpen === 'undefined') {
                        log.info(`opening ${team.name}___${tab.name} on hasPlaybooks`);
                        tab.isOpen = true;
                        hasUpdates = true;
                    }
                    if (tab.name === TAB_FOCALBOARD && remoteInfo.hasFocalboard && typeof tab.isOpen === 'undefined') {
                        log.info(`opening ${team.name}___${tab.name} on hasFocalboard`);
                        tab.isOpen = true;
                        hasUpdates = true;
                    }
                }
            });
        }
        return hasUpdates;
    }
}

const serverManager = new ServerManager();
export default serverManager;
