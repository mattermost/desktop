// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const CALLS_E2E_DISPLAY_PREFIX: string;
export const CALLS_E2E_NAME_PATTERN: RegExp;
export const LEFTOVER_CALLS_MAX_AGE_MS: number;

export type LeftoverCallsChannel = {
    name: string;
    display_name?: string;
    delete_at?: number;
    type?: string;
    create_at?: number;
};

export function isLeftoverCallsE2EChannel(channel: LeftoverCallsChannel): boolean;
export function isStaleLeftoverCallsE2EChannel(channel: LeftoverCallsChannel, now?: number): boolean;
