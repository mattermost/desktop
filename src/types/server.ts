// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type RemoteInfo = {
    serverVersion?: string;
    siteName?: string;
    siteURL?: string;
    hasFocalboard?: boolean;
    hasPlaybooks?: boolean;
};

export type ClientConfig = {
    Version: string;
    SiteURL: string;
    SiteName: string;
    BuildBoards: string;
}

export type URLValidationResult = {
    status: string;
    validatedURL?: string;
    existingServerName?: string;
    serverVersion?: string;
    serverName?: string;
}
