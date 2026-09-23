// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {apiArchiveChannel, apiCreateChannel} from './channel';
import {apiLogin, apiRequest} from './client';

export type TestUser = {
    id: string;
    username: string;
    email: string;
    password: string;
};

export type TestChannel = {
    id: string;
    name: string;
};

type CreatedUser = {id: string; username: string; email: string};
type Team = {id: string; name: string};

export async function apiCreateUser(
    baseUrl: string,
    adminToken: string,
    username: string,
    email: string,
    password: string,
): Promise<TestUser> {
    const user = await apiRequest<CreatedUser>(baseUrl, adminToken, '/api/v4/users', {
        method: 'POST',
        body: JSON.stringify({username, email, password, email_verified: true}),
    });
    return {...user, password};
}

export async function apiAddUserToTeam(
    baseUrl: string,
    adminToken: string,
    teamId: string,
    userId: string,
): Promise<void> {
    await apiRequest<unknown>(baseUrl, adminToken, `/api/v4/teams/${teamId}/members`, {
        method: 'POST',
        body: JSON.stringify({team_id: teamId, user_id: userId}),
    });
}

export async function apiGetAdminTeamId(baseUrl: string, adminToken: string): Promise<string> {
    const teams = await apiRequest<Team[]>(baseUrl, adminToken, '/api/v4/users/me/teams');
    if (!teams.length) {
        throw new Error('Admin user belongs to no teams — cannot provision test users');
    }
    return teams[0].id;
}

let userSeq = 0;

// Every user this worker created, so a spec's afterAll can deactivate them instead
// of leaving one account per test behind on the server for the life of the instance.
const createdUserIds: string[] = [];

export async function createCallsTestUser(
    baseUrl: string,
    adminToken: string,
    teamId: string,
): Promise<TestUser> {
    userSeq++;
    const suffix = `${Date.now()}-${userSeq}`;
    const username = `calls-e2e-${suffix}`;
    const email = `${username}@test.example.com`;
    const password = 'Calls-E2E-test1!';
    const user = await apiCreateUser(baseUrl, adminToken, username, email, password);
    createdUserIds.push(user.id);
    await apiAddUserToTeam(baseUrl, adminToken, teamId, user.id);
    return user;
}

let channelSeq = 0;
const createdChannelIds: string[] = [];

/**
 * Private channel for one Calls test, created as that test user so the shared
 * admin (LHS / channel-menu specs) never sees it. Town Square is shared across
 * Windows/macOS workers (2 in CI), so parallel `/call start` hits "A call is
 * already ongoing in the channel" and can close the other worker's widget.
 */
export async function createCallsTestChannel(
    baseUrl: string,
    teamId: string,
    user: TestUser,
): Promise<TestChannel> {
    channelSeq++;
    const name = `e2ec${process.env.TEST_WORKER_INDEX ?? '0'}${Date.now()}${channelSeq}`;
    const userToken = await apiLogin(baseUrl, user.username, user.password);
    const channel = await apiCreateChannel(
        baseUrl,
        userToken,
        teamId,
        name,
        `Calls E2E ${name}`,
        'P',
    );
    createdChannelIds.push(channel.id);
    return {id: channel.id, name: channel.name};
}

/**
 * Archive every Calls test channel this worker created. Best-effort — leftover
 * private channels on the shared admin team fill the LHS ("More unreads") and
 * break hover-gated channel menus (T1307 / T125 / T5890).
 */
export async function archiveCallsTestChannels(baseUrl: string, adminToken: string): Promise<void> {
    const ids = createdChannelIds.splice(0, createdChannelIds.length);

    await Promise.all(ids.map(async (id) => {
        try {
            await apiArchiveChannel(baseUrl, adminToken, id);
        } catch {
            // Leaving a stray archived-fail channel is not worth failing a spec.
        }
    }));
}

/**
 * Deactivate every user created by createCallsTestUser in this worker.
 *
 * Deactivation, not deletion: permanent deletion needs
 * ServiceSettings.EnableAPIUserDeletion, which test servers do not enable, and it is
 * irreversible. Deactivating is enough to keep the user list from growing without
 * bound and is always available to an admin.
 *
 * Best-effort — a cleanup failure must never fail an otherwise-green spec.
 */
export async function deactivateCallsTestUsers(baseUrl: string, adminToken: string): Promise<void> {
    const ids = createdUserIds.splice(0, createdUserIds.length);

    await Promise.all(ids.map(async (id) => {
        try {
            await apiRequest<unknown>(baseUrl, adminToken, `/api/v4/users/${id}/active`, {
                method: 'PUT',
                body: JSON.stringify({active: false}),
            });
        } catch {
            // Leaving a stray test user behind is not worth failing a run over.
        }
    }));
}
