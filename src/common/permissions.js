
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// channel types for managing permissions
export const REQUEST_PERMISSION_CHANNEL = 'request-permission';
export const GRANT_PERMISSION_CHANNEL = 'grant-permission';
export const DENY_PERMISSION_CHANNEL = 'deny-permission';

// Permission types that can be requested
export const BASIC_AUTH_PERMISSION = 'canBasicAuth';

// Permission descriptions
export const PERMISSION_DESCRIPTION = {
  [BASIC_AUTH_PERMISSION]: 'Web Authentication',
};