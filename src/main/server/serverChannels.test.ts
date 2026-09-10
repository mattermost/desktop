// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Session, Cookie} from 'electron';
import {session} from 'electron';

import type {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';
import {getServerAPI} from 'main/server/serverAPI';
import {
    fetchServerJSON,
    getChannelsForServer,
    handleGetAvailableChannels,
    hasServerAuthCookies,
} from 'main/server/serverChannels';

jest.mock('electron', () => ({
    session: {
        defaultSession: {
            cookies: {
                get: jest.fn().mockResolvedValue([]),
            },
        },
    },
}));

jest.mock('common/servers/serverManager', () => ({
    getAllServers: jest.fn(),
}));

jest.mock('main/server/serverAPI', () => ({
    getServerAPI: jest.fn(),
}));

const mockGetServerAPI = jest.mocked(getServerAPI);
const mockServerManager = jest.mocked(ServerManager);

describe('main/server/serverChannels', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('hasServerAuthCookies', () => {
        it('should return true when all required cookies are present', async () => {
            const mockSession = {
                cookies: {
                    get: jest.fn().mockResolvedValue([
                        {name: 'MMUSERID', domain: '.mattermost.com'},
                        {name: 'MMCSRF', domain: '.mattermost.com'},
                        {name: 'MMAUTHTOKEN', domain: '.mattermost.com'},
                    ]),
                },
            } as unknown as Session;

            const result = await hasServerAuthCookies(new URL('https://sub.mattermost.com'), mockSession);
            expect(result).toBe(true);
        });

        it('should return false when a required cookie is missing', async () => {
            const mockSession = {
                cookies: {
                    get: jest.fn().mockResolvedValue([
                        {name: 'MMUSERID', domain: '.mattermost.com'},
                        {name: 'MMCSRF', domain: '.mattermost.com'},
                    ]),
                },
            } as unknown as Session;

            const result = await hasServerAuthCookies(new URL('https://sub.mattermost.com'), mockSession);
            expect(result).toBe(false);
        });

        it('should return false on cookie retrieval error', async () => {
            const mockSession = {
                cookies: {
                    get: jest.fn().mockRejectedValue(new Error('Session error')),
                },
            } as unknown as Session;

            const result = await hasServerAuthCookies(new URL('https://mattermost.com'), mockSession);
            expect(result).toBe(false);
        });
    });

    describe('fetchServerJSON', () => {
        it('should resolve parsed JSON on success', async () => {
            const mockData = [{id: 'ch1', name: 'general'}];
            mockGetServerAPI.mockImplementation((url, auth, success) => {
                success?.(JSON.stringify(mockData));
                return Promise.resolve();
            });

            const result = await fetchServerJSON<typeof mockData>(new URL('https://example.com/api'));
            expect(result).toEqual(mockData);
        });

        it('should reject when error callback is called', async () => {
            mockGetServerAPI.mockImplementation((url, auth, success, abort, error) => {
                error?.(new Error('Request failed'));
                return Promise.resolve();
            });

            await expect(fetchServerJSON(new URL('https://example.com/api'))).rejects.toThrow('Request failed');
        });

        it('should reject on invalid JSON response', async () => {
            mockGetServerAPI.mockImplementation((url, auth, success) => {
                success?.('<html>Invalid JSON</html>');
                return Promise.resolve();
            });

            await expect(fetchServerJSON(new URL('https://example.com/api'))).rejects.toThrow();
        });
    });

    describe('getChannelsForServer', () => {
        const mockServer: MattermostServer = {
            id: 'server-1',
            name: 'Community',
            url: new URL('https://community.mattermost.com'),
        } as unknown as MattermostServer;

        const mockSession = {
            cookies: {
                get: jest.fn().mockResolvedValue([
                    {name: 'MMUSERID', domain: '.mattermost.com'},
                    {name: 'MMCSRF', domain: '.mattermost.com'},
                    {name: 'MMAUTHTOKEN', domain: '.mattermost.com'},
                ]),
            },
        } as unknown as Session;

        it('should return empty array if auth cookies are missing', async () => {
            const unauthSession = {
                cookies: {
                    get: jest.fn().mockResolvedValue([]),
                },
            } as unknown as Session;

            const channels = await getChannelsForServer(mockServer, unauthSession);
            expect(channels).toEqual([]);
        });

        it('should fetch channels and teams, formatting labels properly', async () => {
            const mockTeams = [{id: 't1', name: 'core', display_name: 'Core Team'}];
            const mockChannels = [
                {id: 'c1', name: 'town-square', display_name: 'Town Square', team_id: 't1', type: 'O'},
                {id: 'c2', name: 'direct-user', display_name: 'Devin Binnie', team_id: '', type: 'D'},
                {id: 'c3', name: 'group-msg', display_name: 'Group Chat', team_id: '', type: 'G'},
            ];

            mockGetServerAPI.mockImplementation((url: URL, auth, success) => {
                if (url.pathname.endsWith('/teams')) {
                    success?.(JSON.stringify(mockTeams));
                } else if (url.pathname.endsWith('/channels')) {
                    success?.(JSON.stringify(mockChannels));
                }
                return Promise.resolve();
            });

            const channels = await getChannelsForServer(mockServer, mockSession);
            expect(channels).toHaveLength(3);
            expect(channels[0]).toEqual({
                id: 'c1',
                name: 'town-square',
                displayName: 'Town Square',
                label: 'Town Square (Core Team - Community)',
                serverName: 'Community',
                teamName: 'Core Team',
            });
            expect(channels[1]).toEqual({
                id: 'c2',
                name: 'direct-user',
                displayName: 'Devin Binnie',
                label: 'Devin Binnie (Direct Message - Community)',
                serverName: 'Community',
                teamName: undefined,
            });
            expect(channels[2]).toEqual({
                id: 'c3',
                name: 'group-msg',
                displayName: 'Group Chat',
                label: 'Group Chat (Group Message - Community)',
                serverName: 'Community',
                teamName: undefined,
            });
        });

        it('should fallback to per-team channels if global channels endpoint returns empty', async () => {
            const mockTeams = [{id: 't1', name: 'team1', display_name: 'Team One'}];
            const mockTeamChannels = [
                {id: 'c1', name: 'general', display_name: 'General', team_id: 't1', type: 'O'},
            ];

            mockGetServerAPI.mockImplementation((url: URL, auth, success) => {
                if (url.pathname.endsWith('/teams')) {
                    success?.(JSON.stringify(mockTeams));
                } else if (url.pathname === '/api/v4/users/me/channels') {
                    success?.(JSON.stringify([]));
                } else if (url.pathname.includes('/teams/t1/channels')) {
                    success?.(JSON.stringify(mockTeamChannels));
                }
                return Promise.resolve();
            });

            const channels = await getChannelsForServer(mockServer, mockSession);
            expect(channels).toHaveLength(1);
            expect(channels[0].label).toBe('General (Team One - Community)');
        });
    });

    describe('handleGetAvailableChannels', () => {
        it('should aggregate channels from all servers and sort by label', async () => {
            const serverA = {
                id: 'srv-1',
                name: 'Server A',
                url: new URL('https://server-a.com'),
            } as unknown as MattermostServer;
            const serverB = {
                id: 'srv-2',
                name: 'Server B',
                url: new URL('https://server-b.com'),
            } as unknown as MattermostServer;

            mockServerManager.getAllServers.mockReturnValue([serverA, serverB]);

            mockGetServerAPI.mockImplementation((url: URL, auth, success) => {
                if (url.origin.includes('server-a')) {
                    if (url.pathname.endsWith('/teams')) {
                        success?.(JSON.stringify([]));
                    } else {
                        success?.(JSON.stringify([{id: 'ch-z', name: 'zebra', display_name: 'Zebra', team_id: '', type: 'O'}]));
                    }
                } else if (url.origin.includes('server-b')) {
                    if (url.pathname.endsWith('/teams')) {
                        success?.(JSON.stringify([]));
                    } else {
                        success?.(JSON.stringify([{id: 'ch-a', name: 'alpha', display_name: 'Alpha', team_id: '', type: 'O'}]));
                    }
                }
                return Promise.resolve();
            });

            jest.mocked(session.defaultSession.cookies.get).mockResolvedValue([
                {name: 'MMUSERID', domain: 'server-a.com'},
                {name: 'MMCSRF', domain: 'server-a.com'},
                {name: 'MMAUTHTOKEN', domain: 'server-a.com'},
                {name: 'MMUSERID', domain: 'server-b.com'},
                {name: 'MMCSRF', domain: 'server-b.com'},
                {name: 'MMAUTHTOKEN', domain: 'server-b.com'},
            ] as unknown as Cookie[]);

            const channels = await handleGetAvailableChannels();
            expect(channels).toHaveLength(2);
            expect(channels[0].label).toBe('Alpha (Server B)');
            expect(channels[1].label).toBe('Zebra (Server A)');
        });
    });
});
