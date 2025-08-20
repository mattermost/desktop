// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Constants for secure storage key suffixes.
 * These suffixes are appended to server URLs to create unique storage keys.
 */
export const SECURE_STORAGE_KEYS = {
    /**
     * Pre-authentication secret shared by server administrators
     * Used to automatically authenticate with servers that require this secret
     */
    PREAUTH: 'preauth',
} as const;

export type SecureStorageKey = typeof SECURE_STORAGE_KEYS[keyof typeof SECURE_STORAGE_KEYS];
