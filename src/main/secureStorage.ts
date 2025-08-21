// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {readFile, writeFile, access, mkdir} from 'fs/promises';
import path from 'path';

import {safeStorage} from 'electron';

import type {SecureStorageKey} from 'common/constants/secureStorage';
import {Logger} from 'common/log';
import {parseURL, getFormattedPathName} from 'common/utils/url';

const log = new Logger('SecureStorage');

const SECURE_STORAGE_DIR = 'secure';
const SECURE_SECRETS_FILE = 'secrets.encrypted';
const PLAINTEXT_SECRETS_FILE = 'secrets.plaintext';
const ENCRYPTION_UNAVAILABLE_WARNING = 'Secure storage is not available on this system. Secrets will be stored in plain text. Consider installing keyring services for better security.';

export class SecureStorage {
    private storageDir: string;
    private secretsPath: string;
    private plaintextSecretsPath: string;
    private memoryCache: Record<string, string> | null = null;
    private encryptionAvailable: boolean;
    private hasWarnedAboutPlaintext: boolean = false;

    constructor(userDataPath: string) {
        this.storageDir = path.join(userDataPath, SECURE_STORAGE_DIR);
        this.secretsPath = path.join(this.storageDir, SECURE_SECRETS_FILE);
        this.plaintextSecretsPath = path.join(this.storageDir, PLAINTEXT_SECRETS_FILE);
        this.encryptionAvailable = safeStorage.isEncryptionAvailable();

        if (!this.encryptionAvailable) {
            log.warn(ENCRYPTION_UNAVAILABLE_WARNING);
        }
    }

    private async ensureStorageDir(): Promise<void> {
        try {
            await access(this.storageDir);
        } catch {
            await mkdir(this.storageDir, {recursive: true});
        }
    }

    private async loadSecrets(): Promise<Record<string, string>> {
        try {
            await this.ensureStorageDir();

            if (this.encryptionAvailable) {
                // Try to load encrypted secrets
                try {
                    const encryptedData = await readFile(this.secretsPath);
                    const decryptedData = safeStorage.decryptString(encryptedData);
                    return JSON.parse(decryptedData);
                } catch (encryptedError: any) {
                    if (encryptedError.code !== 'ENOENT') {
                        log.warn('Failed to load encrypted secrets, trying plaintext fallback:', encryptedError);
                    }
                }
            }

            // Fall back to plaintext storage (or use it directly if encryption unavailable)
            try {
                const plaintextData = await readFile(this.plaintextSecretsPath, 'utf-8');
                return JSON.parse(plaintextData);
            } catch (plaintextError: any) {
                if (plaintextError.code === 'ENOENT') {
                    log.debug('Secrets file does not exist, starting with empty storage');
                } else {
                    log.warn('Failed to load plaintext secrets:', plaintextError);
                }
                return {};
            }
        } catch (error) {
            log.error('Failed to load secrets:', error);
            return {};
        }
    }

    private async saveSecrets(secrets: Record<string, string>): Promise<void> {
        try {
            await this.ensureStorageDir();
            const jsonData = JSON.stringify(secrets, null, 2);

            if (this.encryptionAvailable) {
                // Save encrypted
                const encryptedData = safeStorage.encryptString(jsonData);
                await writeFile(this.secretsPath, encryptedData);
                log.debug('Secrets saved with encryption');
            } else {
                // Save as plaintext with warning
                if (!this.hasWarnedAboutPlaintext) {
                    log.warn(ENCRYPTION_UNAVAILABLE_WARNING);
                    this.hasWarnedAboutPlaintext = true;
                }
                await writeFile(this.plaintextSecretsPath, jsonData, 'utf-8');
                log.debug('Secrets saved in plaintext (encryption unavailable)');
            }

            // Update memory cache
            this.memoryCache = {...secrets};
        } catch (error) {
            log.error('Failed to save secrets:', error);
            throw new Error('Failed to save secure data');
        }
    }

    async initializeCache(): Promise<void> {
        if (this.memoryCache === null) {
            this.memoryCache = await this.loadSecrets();
            log.info('Initialized secure storage cache');
        }
    }

    private async getSecretsFromCache(): Promise<Record<string, string>> {
        if (this.memoryCache === null) {
            await this.initializeCache();
        }
        return this.memoryCache!;
    }

    async setSecret(serverUrl: string, keySuffix: SecureStorageKey, value: string): Promise<void> {
        if (!value || value.trim().length === 0) {
            await this.deleteSecret(serverUrl, keySuffix);
            return;
        }

        const secrets = await this.getSecretsFromCache();
        const normalizedUrl = this.normalizeUrl(serverUrl);
        const secretKey = `${normalizedUrl}:${keySuffix}`;
        secrets[secretKey] = value.trim();
        await this.saveSecrets(secrets);
        log.debug(`Set secret for ${secretKey} (${this.encryptionAvailable ? 'encrypted' : 'plaintext'})`);
    }

    private normalizeUrl(url: string): string {
        try {
            const parsed = parseURL(url);
            if (!parsed) {
                log.warn(`Failed to parse URL for secure storage: ${url}`);
                return url;
            }

            // Use protocol + hostname + port + path for server identity
            // This preserves subpaths to support multiple Mattermost instances on the same domain
            // e.g., https://company.com/mattermost-dev vs https://company.com/mattermost-prod
            const normalizedPath = getFormattedPathName(parsed.pathname);
            return `${parsed.origin}${normalizedPath}`;
        } catch (error) {
            log.warn(`Failed to normalize URL for secure storage: ${url}`, error);

            // Fallback to the original URL if parsing fails
            return url;
        }
    }

    async getSecret(serverUrl: string, keySuffix: SecureStorageKey): Promise<string | null> {
        const secrets = await this.getSecretsFromCache();
        const normalizedUrl = this.normalizeUrl(serverUrl);
        const secretKey = `${normalizedUrl}:${keySuffix}`;
        const secret = secrets[secretKey] || null;
        log.debug(`Retrieved secret for ${secretKey}: ${secret ? '[HIDDEN]' : 'null'} (${this.encryptionAvailable ? 'encrypted' : 'plaintext'})`);
        return secret;
    }

    async deleteSecret(serverUrl: string, keySuffix: SecureStorageKey): Promise<void> {
        const secrets = await this.getSecretsFromCache();
        const normalizedUrl = this.normalizeUrl(serverUrl);
        const secretKey = `${normalizedUrl}:${keySuffix}`;
        delete secrets[secretKey];
        await this.saveSecrets(secrets);
        log.debug(`Deleted secret for ${secretKey}`);
    }

    async hasSecret(serverUrl: string, keySuffix: SecureStorageKey): Promise<boolean> {
        const secrets = await this.getSecretsFromCache();
        const normalizedUrl = this.normalizeUrl(serverUrl);
        const secretKey = `${normalizedUrl}:${keySuffix}`;
        return secretKey in secrets;
    }

    isEncrypted(): boolean {
        return this.encryptionAvailable;
    }

    // Debug method to list all stored keys
    async getAllSecretKeys(): Promise<string[]> {
        const secrets = await this.getSecretsFromCache();
        return Object.keys(secrets);
    }

    // Get storage status information for user-facing warnings
    getStorageStatus(): { encrypted: boolean; available: boolean; warning?: string } {
        return {
            encrypted: this.encryptionAvailable,
            available: true,
            warning: this.encryptionAvailable ? undefined : ENCRYPTION_UNAVAILABLE_WARNING,
        };
    }
}

let secureStorageInstance: SecureStorage | null = null;

export function getSecureStorage(userDataPath: string): SecureStorage {
    if (!secureStorageInstance) {
        secureStorageInstance = new SecureStorage(userDataPath);
    }
    return secureStorageInstance;
}
