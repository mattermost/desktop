// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app} from 'electron';

import {SECURE_STORAGE_KEYS} from 'common/constants/secureStorage';
import {Logger} from 'common/log';
import {getSecureStorage} from 'main/secureStorage';

const log = new Logger('PreAuthSecretHelper');

/**
 * Normalizes a pre-auth secret value by trimming whitespace
 * @param secretValue The raw secret value (may be undefined or empty)
 * @returns The trimmed secret value or undefined if empty
 */
export const normalizePreAuthSecret = (secretValue?: string): string | undefined => {
    if (!secretValue) {
        return undefined;
    }
    
    const trimmed = secretValue.trim();
    return trimmed || undefined;
};

/**
 * Saves or deletes a pre-auth secret in secure storage based on server data
 * @param serverData Object that may contain preAuthSecret
 * @param serverUrl The server URL to use as the key
 */
export const saveOrDeletePreAuthSecret = async (
    serverData: {preAuthSecret?: string},
    serverUrl: string
): Promise<void> => {
    if ('preAuthSecret' in serverData) {
        const normalizedSecret = normalizePreAuthSecret(serverData.preAuthSecret);
        
        try {
            const secureStorage = getSecureStorage(app.getPath('userData'));
            
            if (normalizedSecret) {
                await secureStorage.setSecret(serverUrl, SECURE_STORAGE_KEYS.PREAUTH, normalizedSecret);
            } else {
                await secureStorage.deleteSecret(serverUrl, SECURE_STORAGE_KEYS.PREAUTH);
            }
        } catch (error) {
            log.error('Failed to persist pre-auth secret to secure storage:', error);
            throw error;
        }
    }
};

/**
 * Saves a pre-auth secret to storage if it has a non-empty value (for adding new servers)
 * @param serverData Object that may contain preAuthSecret
 * @param serverUrl The server URL for storage
 */
export const savePreAuthSecret = async (
    serverData: {preAuthSecret?: string}, 
    serverUrl: string
): Promise<void> => {
    if (serverData.preAuthSecret) {
        const normalizedSecret = normalizePreAuthSecret(serverData.preAuthSecret);
        if (normalizedSecret) {
            try {
                const secureStorage = getSecureStorage(app.getPath('userData'));
                await secureStorage.setSecret(serverUrl, SECURE_STORAGE_KEYS.PREAUTH, normalizedSecret);
            } catch (error) {
                log.error('Failed to persist pre-auth secret to secure storage:', error);
                throw error;
            }
        }
    }
};


/**
 * Extracts and normalizes pre-auth secret from server data for in-memory use
 * @param serverData Object that may contain preAuthSecret
 * @returns The normalized secret value or undefined
 */
export const extractPreAuthSecret = (serverData: {preAuthSecret?: string}): string | undefined => {
    if ('preAuthSecret' in serverData) {
        return normalizePreAuthSecret(serverData.preAuthSecret);
    }
    return undefined;
};