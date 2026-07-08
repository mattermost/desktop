// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {resolveChannelByName} from './channel';
import {apiLogin, apiRequest} from './client';
import {getTestServerCredentials} from './credentials';

type Post = {
    id: string;
    message: string;
    root_id: string;
};

export async function apiCreatePost(
    channelId: string,
    message: string,
    rootId = '',
    credentials = getTestServerCredentials(),
): Promise<Post> {
    const token = await apiLogin(credentials.baseUrl, credentials.username, credentials.password);
    return apiRequest<Post>(credentials.baseUrl, token, '/api/v4/posts', {
        method: 'POST',
        body: JSON.stringify({
            channel_id: channelId,
            message,
            root_id: rootId,
        }),
    });
}

/** Seed a thread root post and one reply so RHS / global threads UI has content. */
export async function seedThreadInChannel(channelName: string): Promise<{rootId: string; replyId: string}> {
    const channel = await resolveChannelByName(channelName);
    const stamp = Date.now();
    const root = await apiCreatePost(channel.id, `e2e thread root ${stamp}`);
    const reply = await apiCreatePost(channel.id, `e2e thread reply ${stamp}`, root.id);
    return {rootId: root.id, replyId: reply.id};
}
