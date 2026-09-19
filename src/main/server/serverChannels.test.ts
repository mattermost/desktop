// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClientRequest, Cookie, Session} from 'electron';
import {net, session} from 'electron';

import type {MattermostServer} from 'common/servers/MattermostServer';
import ServerManager from 'common/servers/serverManager';
import {getServerAPI} from 'main/server/serverAPI';
import {
    fetchServerJSON,
    formatUserDisplayName,
    getChannelsForServer,
    handleGetAvailableChannels,
    hasServerAuthCookies,
    postServerJSON,
} from 'main/server/serverChannels';

jest.mock('electron', () => ({
    net: {
        request: jest.fn(),
    },
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

    describe('formatUserDisplayName', () => {
        it('should format full name with username', () => {
            expect(formatUserDisplayName({
                id: 'u1',
                username: 'devinbinnie',
                first_name: 'Devin',
                last_name: 'Binnie',
            })).toBe('Devin Binnie (@devinbinnie)');
        });

        it('should format single name with username', () => {
            expect(formatUserDisplayName({
                id: 'u2',
                username: 'amancina',
                first_name: 'Angelo',
            })).toBe('Angelo (@amancina)');
        });

        it('should fallback to username if no first or last name', () => {
            expect(formatUserDisplayName({
                id: 'u3',
                username: 'matterbot',
            })).toBe('@matterbot');
        });

        it('should fallback to nickname if no username or name', () => {
            expect(formatUserDisplayName({
                id: 'u4',
                username: '',
                nickname: 'CoolGuy',
            })).toBe('CoolGuy');
        });

        it('should fallback to id if no other fields', () => {
            expect(formatUserDisplayName({
                id: 'u5',
                username: '',
            })).toBe('u5');
        });
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
            expect(mockSession.cookies.get).toHaveBeenCalledWith({url: 'https://sub.mattermost.com/'});
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
                return Promise.resolve(undefined);
            });

            await expect(fetchServerJSON(new URL('https://example.com/api'))).rejects.toThrow();
        });

        it('should abort request and signal on timeout', async () => {
            const mockAbort = jest.fn();
            let capturedSignal: AbortSignal | undefined;

            mockGetServerAPI.mockImplementation((url, auth, success, abort, error, targetSession, signal) => {
                capturedSignal = signal;
                return Promise.resolve({
                    abort: mockAbort,
                } as unknown as ClientRequest);
            });

            const promise = fetchServerJSON(new URL('https://example.com/api'), 50);
            await expect(promise).rejects.toThrow('Timeout fetching https://example.com/api');
            expect(capturedSignal?.aborted).toBe(true);
            expect(mockAbort).toHaveBeenCalled();
        });
    });

    describe('postServerJSON', () => {
        it('should post data and parse response on success', async () => {
            const mockReq = {
                setHeader: jest.fn(),
                on: jest.fn().mockImplementation((event, cb) => {
                    if (event === 'response') {
                        cb({
                            statusCode: 200,
                            on: jest.fn().mockImplementation((resEvent: string, resCb: (chunk?: Buffer) => void) => {
                                if (resEvent === 'data') {
                                    resCb(Buffer.from(JSON.stringify({ok: true})));
                                } else if (resEvent === 'end') {
                                    resCb();
                                }
                            }),
                        });
                    }
                }),
                write: jest.fn(),
                end: jest.fn(),
            };
            jest.mocked(net.request).mockReturnValue(mockReq as unknown as Electron.ClientRequest);

            const result = await postServerJSON<{ok: boolean}>(new URL('https://example.com/api'), {test: 1}, 'csrf-123');
            expect(result).toEqual({ok: true});
            expect(mockReq.setHeader).toHaveBeenCalledWith('X-CSRF-Token', 'csrf-123');
            expect(mockReq.write).toHaveBeenCalledWith(JSON.stringify({test: 1}));
            expect(mockReq.end).toHaveBeenCalled();
        });

        it('should reject on non-2xx status code', async () => {
            const mockReq = {
                setHeader: jest.fn(),
                on: jest.fn().mockImplementation((event, cb) => {
                    if (event === 'response') {
                        cb({
                            statusCode: 500,
                            on: jest.fn(),
                        });
                    }
                }),
                write: jest.fn(),
                end: jest.fn(),
            };
            jest.mocked(net.request).mockReturnValue(mockReq as unknown as Electron.ClientRequest);

            await expect(postServerJSON(new URL('https://example.com/api'), {})).rejects.toThrow('Bad status code 500');
        });

        it('should properly concatenate multi-chunk response with UTF-8 characters across chunk boundaries', async () => {
            const rawJson = JSON.stringify({name: 'René François'});
            const fullBuffer = Buffer.from(rawJson, 'utf8');
            const splitIndex = fullBuffer.indexOf(Buffer.from('é', 'utf8')) + 1;
            const chunk1 = fullBuffer.subarray(0, splitIndex);
            const chunk2 = fullBuffer.subarray(splitIndex);

            const mockReq = {
                setHeader: jest.fn(),
                on: jest.fn().mockImplementation((event, cb) => {
                    if (event === 'response') {
                        cb({
                            statusCode: 200,
                            on: jest.fn().mockImplementation((resEvent: string, resCb: (chunk?: Buffer) => void) => {
                                if (resEvent === 'data') {
                                    resCb(chunk1);
                                    resCb(chunk2);
                                } else if (resEvent === 'end') {
                                    resCb();
                                }
                            }),
                        });
                    }
                }),
                write: jest.fn(),
                end: jest.fn(),
            };
            jest.mocked(net.request).mockReturnValue(mockReq as unknown as Electron.ClientRequest);

            const result = await postServerJSON<{name: string}>(new URL('https://example.com/api'), {});
            expect(result).toEqual({name: 'René François'});
        });

        it('should call req.abort() and reject with timeout error on timeout', async () => {
            jest.useFakeTimers();
            const mockReq = {
                setHeader: jest.fn(),
                on: jest.fn(),
                write: jest.fn(),
                end: jest.fn(),
                abort: jest.fn(),
            };
            jest.mocked(net.request).mockReturnValue(mockReq as unknown as Electron.ClientRequest);

            const promise = postServerJSON(new URL('https://example.com/api'), {}, undefined, 1000);
            jest.advanceTimersByTime(1000);

            await expect(promise).rejects.toThrow('Timeout posting to https://example.com/api');
            expect(mockReq.abort).toHaveBeenCalled();
            jest.useRealTimers();
        });
    });

    describe('getChannelsForServer', () => {
        const mockServer: MattermostServer = {
            id: 'server-1',
            name: 'Community',
            url: new URL('https://community.mattermost.com'),
        } as unknown as MattermostServer;

        it('should return empty array if auth cookies are missing', async () => {
            const unauthSession = {
                cookies: {
                    get: jest.fn().mockResolvedValue([]),
                },
            } as unknown as Session;

            const channels = await getChannelsForServer(mockServer, unauthSession);
            expect(channels).toEqual([]);
        });

        it('should fetch channels, resolve DM other speaker names, and format labels properly', async () => {
            const mockTeams = [{id: 't1', name: 'core', display_name: 'Core Team'}];
            const mockChannels = [
                {id: 'c1', name: 'town-square', display_name: 'Town Square', team_id: 't1', type: 'O'},
                {id: 'c2', name: 'my_user_id__other_user_id', display_name: '', team_id: '', type: 'D'},
                {id: 'c3', name: 'group-msg', display_name: 'Group Chat', team_id: '', type: 'G'},
            ];
            const mockUser = {
                id: 'other_user_id',
                username: 'devinbinnie',
                first_name: 'Devin',
                last_name: 'Binnie',
            };

            const mockReq = {
                setHeader: jest.fn(),
                on: jest.fn().mockImplementation((event, cb) => {
                    if (event === 'response') {
                        cb({
                            statusCode: 200,
                            on: jest.fn().mockImplementation((resEvent: string, resCb: (chunk?: Buffer) => void) => {
                                if (resEvent === 'data') {
                                    resCb(Buffer.from(JSON.stringify([mockUser])));
                                } else if (resEvent === 'end') {
                                    resCb();
                                }
                            }),
                        });
                    }
                }),
                write: jest.fn(),
                end: jest.fn(),
            };
            jest.mocked(net.request).mockReturnValue(mockReq as unknown as Electron.ClientRequest);

            mockGetServerAPI.mockImplementation((url: URL, auth, success) => {
                if (url.pathname.endsWith('/teams')) {
                    success?.(JSON.stringify(mockTeams));
                } else if (url.pathname.endsWith('/channels')) {
                    success?.(JSON.stringify(mockChannels));
                }
                return Promise.resolve();
            });

            const sessionWithCookies = {
                cookies: {
                    get: jest.fn().mockResolvedValue([
                        {name: 'MMUSERID', value: 'my_user_id', domain: '.mattermost.com'},
                        {name: 'MMCSRF', value: 'csrf_tok', domain: '.mattermost.com'},
                        {name: 'MMAUTHTOKEN', value: 'auth_tok', domain: '.mattermost.com'},
                    ]),
                },
            } as unknown as Session;

            const channels = await getChannelsForServer(mockServer, sessionWithCookies);
            expect(channels).toHaveLength(3);
            expect(channels[0]).toEqual({
                id: 'c1',
                name: 'town-square',
                displayName: 'Town Square',
                label: 'Town Square (Core Team - Community)',
                serverName: 'Community',
                teamName: 'Core Team',
            });

            // DM channel should now show speaker name and username instead of raw unique ID!
            expect(channels[1]).toEqual({
                id: 'c2',
                name: 'devinbinnie',
                displayName: 'Devin Binnie (@devinbinnie)',
                label: 'Devin Binnie (@devinbinnie) (Direct Message - Community)',
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

        it('should fallback to GET /api/v4/users/{id} if bulk POST users fails', async () => {
            const mockChannels = [
                {id: 'c2', name: 'my_user_id__other_user_id', display_name: '', team_id: '', type: 'D'},
            ];
            const mockUser = {
                id: 'other_user_id',
                username: 'alice',
                first_name: 'Alice',
                last_name: 'Wonder',
            };

            jest.mocked(net.request).mockImplementation(() => {
                throw new Error('Network error');
            });

            mockGetServerAPI.mockImplementation((url: URL, auth, success) => {
                if (url.pathname.endsWith('/teams')) {
                    success?.(JSON.stringify([]));
                } else if (url.pathname.endsWith('/channels')) {
                    success?.(JSON.stringify(mockChannels));
                } else if (url.pathname.includes('/users/other_user_id')) {
                    success?.(JSON.stringify(mockUser));
                }
                return Promise.resolve();
            });

            const sessionWithCookies = {
                cookies: {
                    get: jest.fn().mockResolvedValue([
                        {name: 'MMUSERID', value: 'my_user_id', domain: '.mattermost.com'},
                        {name: 'MMCSRF', value: 'csrf_tok', domain: '.mattermost.com'},
                        {name: 'MMAUTHTOKEN', value: 'auth_tok', domain: '.mattermost.com'},
                    ]),
                },
            } as unknown as Session;

            const channels = await getChannelsForServer(mockServer, sessionWithCookies);
            expect(channels).toHaveLength(1);
            expect(channels[0]).toEqual({
                id: 'c2',
                name: 'alice',
                displayName: 'Alice Wonder (@alice)',
                label: 'Alice Wonder (@alice) (Direct Message - Community)',
                serverName: 'Community',
                teamName: undefined,
            });
        });

        it('should fetch fallback user profiles in batches of at most 5', async () => {
            const mockChannels = Array.from({length: 8}, (_, i) => ({
                id: `c_${i}`,
                name: `my_user_id__user_${i}`,
                display_name: '',
                team_id: '',
                type: 'D',
            }));

            jest.mocked(net.request).mockImplementation(() => {
                throw new Error('Bulk POST disabled');
            });

            let currentConcurrent = 0;
            let maxConcurrent = 0;

            mockGetServerAPI.mockImplementation(async (url: URL, auth, success) => {
                if (url.pathname.endsWith('/teams')) {
                    success?.(JSON.stringify([]));
                } else if (url.pathname.endsWith('/channels')) {
                    success?.(JSON.stringify(mockChannels));
                } else if (url.pathname.includes('/users/user_')) {
                    currentConcurrent++;
                    maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
                    await new Promise((r) => setTimeout(r, 10));
                    currentConcurrent--;
                    const userId = url.pathname.split('/').pop();
                    success?.(JSON.stringify({
                        id: userId,
                        username: userId,
                        first_name: 'User',
                        last_name: `${userId}`,
                    }));
                }
                return Promise.resolve(undefined);
            });

            const sessionWithCookies = {
                cookies: {
                    get: jest.fn().mockResolvedValue([
                        {name: 'MMUSERID', value: 'my_user_id', domain: '.mattermost.com'},
                        {name: 'MMCSRF', value: 'csrf_tok', domain: '.mattermost.com'},
                        {name: 'MMAUTHTOKEN', value: 'auth_tok', domain: '.mattermost.com'},
                    ]),
                },
            } as unknown as Session;

            const channels = await getChannelsForServer(mockServer, sessionWithCookies);
            expect(channels).toHaveLength(8);
            expect(maxConcurrent).toBeLessThanOrEqual(5);
        });

        it('should not display raw user IDs when user profile cannot be resolved', async () => {
            const mockChannels = [
                {id: 'c2', name: 'my_user_id__other_user_id', display_name: '', team_id: '', type: 'D'},
            ];

            jest.mocked(net.request).mockImplementation(() => {
                throw new Error('Network error');
            });

            mockGetServerAPI.mockImplementation((url: URL, auth, success, abort, error) => {
                if (url.pathname.endsWith('/teams')) {
                    success?.(JSON.stringify([]));
                } else if (url.pathname.endsWith('/channels')) {
                    success?.(JSON.stringify(mockChannels));
                } else if (url.pathname.includes('/users/other_user_id')) {
                    error?.(new Error('User not found'));
                }
                return Promise.resolve();
            });

            const sessionWithCookies = {
                cookies: {
                    get: jest.fn().mockResolvedValue([
                        {name: 'MMUSERID', value: 'my_user_id', domain: '.mattermost.com'},
                        {name: 'MMCSRF', value: 'csrf_tok', domain: '.mattermost.com'},
                        {name: 'MMAUTHTOKEN', value: 'auth_tok', domain: '.mattermost.com'},
                    ]),
                },
            } as unknown as Session;

            const channels = await getChannelsForServer(mockServer, sessionWithCookies);
            expect(channels).toHaveLength(1);
            expect(channels[0].label).toBe('Direct Message (Community)');
            expect(channels[0].label).not.toContain('my_user_id__other_user_id');
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

            const sessionWithCookies = {
                cookies: {
                    get: jest.fn().mockResolvedValue([
                        {name: 'MMUSERID', value: 'my_user_id', domain: '.mattermost.com'},
                        {name: 'MMCSRF', value: 'csrf_tok', domain: '.mattermost.com'},
                        {name: 'MMAUTHTOKEN', value: 'auth_tok', domain: '.mattermost.com'},
                    ]),
                },
            } as unknown as Session;

            const channels = await getChannelsForServer(mockServer, sessionWithCookies);
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
