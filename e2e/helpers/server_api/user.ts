// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {apiAddUserToChannel, apiCreateChannel} from './channel';
import {apiRequest} from './client';

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

/**
 * Private channel for one Calls test. Town Square is shared across Windows/macOS
 * workers (2 in CI), so parallel `/call start` hits "A call is already ongoing
 * in the channel" and can close the other worker's widget mid-connect.
 */
export async function createCallsTestChannel(
    baseUrl: string,
    adminToken: string,
    teamId: string,
    userId: string,
): Promise<TestChannel> {
    channelSeq++;
    const name = `e2ec${process.env.TEST_WORKER_INDEX ?? '0'}${Date.now()}${channelSeq}`;
    const channel = await apiCreateChannel(
        baseUrl,
        adminToken,
        teamId,
        name,
        `Calls E2E ${name}`,
        'P',
    );
    await apiAddUserToChannel(baseUrl, adminToken, channel.id, userId);
    return {id: channel.id, name: channel.name};
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
