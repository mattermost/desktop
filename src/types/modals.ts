// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {
    AuthInfo,
    AuthenticationResponseDetails,
    Certificate,
} from 'electron/common';

import type {PermissionType} from './trustedOrigin';

export type CertificateModalInfo = {
    url: string;
    list: Certificate[];
}

export type LoginModalInfo = {
    request: AuthenticationResponseDetails;
    authInfo: AuthInfo;
}

export type PermissionModalInfo = {
    url: string;
    permission: PermissionType;
}
