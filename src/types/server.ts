// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type RemoteInfo = {
    serverVersion?: string;
    siteName?: string;
    siteURL?: string;
    licenseSku?: string;
    helpLink?: string;
    reportProblemLink?: string;
    hasFocalboard?: boolean;
    hasPlaybooks?: boolean;
    hasUserSurvey?: boolean;
};

export type ClientConfig = {
    Version: string;
    SiteURL: string;
    SiteName: string;
    BuildBoards: string;
    HelpLink: string;
    ReportAProblemLink: string;
}

export type URLValidationResult = {
    status: string;
    validatedURL?: string;
    existingServerName?: string;
    serverVersion?: string;
    serverName?: string;
}
