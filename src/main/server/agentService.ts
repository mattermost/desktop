// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcMain} from 'electron';

import {GET_AVAILABLE_AGENTS} from 'common/communication';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import type {MattermostServer} from 'common/servers/MattermostServer';
import {AGENTS_PLUGIN_ID} from 'common/utils/constants';
import {parseURL} from 'common/utils/url';

import type {AgentBotsResponse, AvailableAgent} from 'types/agent';

import {getServerAPI} from './serverAPI';

const log = new Logger('AgentService');

export class AgentService {
    init = () => {
        ipcMain.handle(GET_AVAILABLE_AGENTS, this.handleGetAvailableAgents);
    };

    private handleGetAvailableAgents = async () => {
        return this.fetchAllAgents();
    };

    fetchAllAgents = async (): Promise<AvailableAgent[]> => {
        const servers = ServerManager.getAllServers();
        const results: AvailableAgent[] = [];

        await Promise.all(servers.map(async (server) => {
            const remoteInfo = ServerManager.getRemoteInfo(server.id);
            if (!remoteInfo?.plugins?.agents?.enabled) {
                return;
            }

            try {
                const agents = await this.fetchAgentsForServer(server);
                results.push(...agents);
            } catch (error) {
                log.warn('Failed to fetch agents for server', {serverId: server.id, error});
            }
        }));

        return results;
    };

    private fetchAgentsForServer = (server: MattermostServer): Promise<AvailableAgent[]> => {
        const url = parseURL(`${server.url}plugins/${AGENTS_PLUGIN_ID}/ai_bots`);
        if (!url) {
            return Promise.reject(new Error('Malformed URL'));
        }

        return new Promise((resolve, reject) => {
            getServerAPI(
                url,
                true,
                (raw: string) => {
                    try {
                        const data = JSON.parse(raw) as AgentBotsResponse;
                        const agents: AvailableAgent[] = (data.bots || []).map((bot) => ({
                            id: bot.id,
                            displayName: bot.displayName,
                            username: bot.username,
                            lastIconUpdate: bot.lastIconUpdate,
                            dmChannelID: bot.dmChannelID,
                            serverId: server.id,
                            serverName: server.name,
                        }));
                        resolve(agents);
                    } catch (e) {
                        reject(e);
                    }
                },
                () => reject(new Error('Aborted')),
                (error: Error) => reject(error),
            );
        });
    };

    destroy = () => {
        ipcMain.removeHandler(GET_AVAILABLE_AGENTS);
    };
}

const agentService = new AgentService();
export default agentService;
