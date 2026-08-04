// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type SAField = {
    name: string;
    type: string;
    ttl_seconds: number;
    grace_period_seconds: number;
    platforms: string[];
};

export type SAPropertyField = {
    name: string;
    type: string;
    attrs: {
        enabled: boolean;
        ttl_seconds: number;
        grace_period_seconds: number;
        platforms: string[];
    };
};

export type InterfaceType = 'wifi' | 'ethernet' | 'cellular' | 'vpn' | 'other';
