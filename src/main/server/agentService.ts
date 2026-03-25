// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcMain} from 'electron';

import {GET_AVAILABLE_AGENTS} from 'common/communication';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import type {MattermostServer} from 'common/servers/MattermostServer';
import {AGENTS_PLUGIN_ID} from 'common/utils/constants';
import {parseURL} from 'common/utils/url';
import ViewManager from 'common/views/viewManager';

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

    sendPromptAndOpenRHS = async (serverId: string, agentId: string, message: string) => {
        // Lazy imports to avoid circular dependency
        const {default: MainWindow} = await import('app/mainWindow/mainWindow');
        const {default: TabManager} = await import('app/tabs/tabManager');
        const {default: WebContentsManager} = await import('app/views/webContentsManager');

        const view = ViewManager.getPrimaryView(serverId);
        if (!view) {
            throw new Error('No primary view for server');
        }

        const webContentsView = WebContentsManager.getView(view.id);
        if (!webContentsView) {
            throw new Error('No web contents view found');
        }

        // Focus the server tab and main window
        TabManager.switchToTab(view.id);
        ServerManager.updateCurrentServer(serverId);
        MainWindow.show();

        // Escape the message for safe injection into JS string
        const escapedMessage = message
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');

        const escapedAgentId = agentId.replace(/'/g, "\\'");
        const escapedPluginId = AGENTS_PLUGIN_ID.replace(/'/g, "\\'");

        // Execute the entire flow in the webapp context via fetch + Redux store
        await webContentsView.getWebContentsView().webContents.executeJavaScript(`
            (async () => {
                try {
                    const state = window.store.getState();
                    const currentUserId = state.entities.users.currentUserId;
                    if (!currentUserId) {
                        throw new Error('No current user');
                    }

                    // Get CSRF token from cookie
                    const csrfToken = document.cookie.split('; ')
                        .find(c => c.startsWith('MMCSRF='))
                        ?.split('=')[1] || '';

                    const headers = {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-Token': csrfToken,
                    };

                    // Create or get existing DM channel with the bot
                    const dmRes = await fetch('/api/v4/channels/direct', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify([currentUserId, '${escapedAgentId}']),
                        credentials: 'include',
                    });
                    if (!dmRes.ok) {
                        throw new Error('Failed to create DM channel: ' + dmRes.status);
                    }
                    const dm = await dmRes.json();

                    // Post the message
                    const postRes = await fetch('/api/v4/posts', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            channel_id: dm.id,
                            message: '${escapedMessage}',
                        }),
                        credentials: 'include',
                    });
                    if (!postRes.ok) {
                        throw new Error('Failed to create post: ' + postRes.status);
                    }
                    const post = await postRes.json();

                    // Open the agents plugin RHS
                    // Find the pluggable component ID registered by the agents plugin
                    const rhsComponents = window.store.getState().plugins?.components?.RightHandSidebarComponent || [];
                    const agentRHS = rhsComponents.find(c => c.pluginId === '${escapedPluginId}');
                    if (agentRHS) {
                        // Dispatch the exact Mattermost webapp action to show a plugin's RHS
                        window.store.dispatch({
                            type: 'UPDATE_RHS_STATE',
                            state: 'plugin',
                            pluggableId: agentRHS.id,
                        });
                    }

                    // Select the post in the agents plugin reducer (after RHS is open)
                    window.store.dispatch({type: 'SELECT_AI_POST', postId: post.id});

                    // Focus the RHS input after it mounts
                    setTimeout(() => {
                        const rhsInput = document.querySelector('#rhsContainer textarea, #rhsContainer [contenteditable="true"], [data-testid="mattermost-ai-rhs"] textarea');
                        if (rhsInput) {
                            rhsInput.focus();
                        }
                    }, 300);
                } catch (e) {
                    console.error('Desktop agent prompt failed:', e);
                }
            })()
        `);
    };

    destroy = () => {
        ipcMain.removeHandler(GET_AVAILABLE_AGENTS);
    };
}

const agentService = new AgentService();
export default agentService;
