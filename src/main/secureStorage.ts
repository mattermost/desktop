// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {safeStorage} from 'electron';
import path from 'path';
import {readFile, writeFile, access, mkdir} from 'fs/promises';

import {Logger} from 'common/log';

const log = new Logger('SecureStorage');

const SECURE_STORAGE_DIR = 'secure';
const SECURE_SECRETS_FILE = 'secrets.encrypted';

export class SecureStorage {
    private storageDir: string;
    private secretsPath: string;
    private memoryCache: Record<string, string> | null = null;

    constructor(userDataPath: string) {
        this.storageDir = path.join(userDataPath, SECURE_STORAGE_DIR);
        this.secretsPath = path.join(this.storageDir, SECURE_SECRETS_FILE);
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
            const encryptedData = await readFile(this.secretsPath);
            const decryptedData = safeStorage.decryptString(encryptedData);
            return JSON.parse(decryptedData);
        } catch (error) {
            log.debug('Failed to load secrets, returning empty object:', error);
            return {};
        }
    }

    private async saveSecrets(secrets: Record<string, string>): Promise<void> {
        try {
            await this.ensureStorageDir();
            const jsonData = JSON.stringify(secrets);
            const encryptedData = safeStorage.encryptString(jsonData);
            await writeFile(this.secretsPath, encryptedData);
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
            log.debug(`Initialized secure storage cache with ${Object.keys(this.memoryCache).length} secrets`);
        }
    }

    private async getSecretsFromCache(): Promise<Record<string, string>> {
        if (this.memoryCache === null) {
            await this.initializeCache();
        }
        return this.memoryCache!;
    }

    async setSecret(serverId: string, key: string, value: string): Promise<void> {
        if (!this.isAvailable()) {
            throw new Error('Secure storage is not available on this system');
        }

        if (!value || value.trim().length === 0) {
            await this.deleteSecret(serverId, key);
            return;
        }

        const secrets = await this.getSecretsFromCache();
        const secretKey = `${serverId}:${key}`;
        secrets[secretKey] = value.trim();
        await this.saveSecrets(secrets);
        log.debug(`Set secret for ${secretKey}`);
    }

    async getSecret(serverId: string, key: string): Promise<string | null> {
        if (!this.isAvailable()) {
            log.debug('Secure storage not available, returning null');
            return null;
        }

        const secrets = await this.getSecretsFromCache();
        const secretKey = `${serverId}:${key}`;
        const secret = secrets[secretKey] || null;
        log.debug(`Retrieved secret for ${secretKey}: ${secret ? '[HIDDEN]' : 'null'}`);
        return secret;
    }

    async deleteSecret(serverId: string, key: string): Promise<void> {
        const secrets = await this.getSecretsFromCache();
        const secretKey = `${serverId}:${key}`;
        delete secrets[secretKey];
        await this.saveSecrets(secrets);
        log.debug(`Deleted secret for ${secretKey}`);
    }

    async deleteAllSecrets(serverId: string): Promise<void> {
        const secrets = await this.getSecretsFromCache();
        const filteredSecrets: Record<string, string> = {};
        
        Object.keys(secrets).forEach((key) => {
            if (!key.startsWith(`${serverId}:`)) {
                filteredSecrets[key] = secrets[key];
            }
        });
        
        await this.saveSecrets(filteredSecrets);
        log.debug(`Deleted all secrets for server ${serverId}`);
    }

    async hasSecret(serverId: string, key: string): Promise<boolean> {
        if (!this.isAvailable()) {
            return false;
        }

        const secrets = await this.getSecretsFromCache();
        const secretKey = `${serverId}:${key}`;
        return secretKey in secrets;
    }

    isAvailable(): boolean {
        const available = safeStorage.isEncryptionAvailable();
        log.debug(`Secure storage available: ${available}`);
        return available;
    }
}

let secureStorageInstance: SecureStorage | null = null;

export function getSecureStorage(userDataPath: string): SecureStorage {
    if (!secureStorageInstance) {
        secureStorageInstance = new SecureStorage(userDataPath);
    }
    return secureStorageInstance;
}