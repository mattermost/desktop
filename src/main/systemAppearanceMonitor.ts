// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {
    SystemAppearanceInvalidation,
    SystemAppearanceSnapshot,
    SystemAppearanceUnknownReason,
} from '@mattermost/desktop-api';

export type PlatformAppearanceUnknownReason = Exclude<SystemAppearanceUnknownReason, 'unstable'>;

export type PlatformAppearanceRead =
    | {status: 'known'; value: 'light' | 'dark'}
    | {status: 'unknown'; reason: PlatformAppearanceUnknownReason};

export type PlatformAppearanceAdapter = {
    read: () => Promise<PlatformAppearanceRead>;
    subscribeInvalidation: (invalidate: () => void) => () => void;
};

type AppearanceRead = {
    revision: number;
    adapterGeneration: number;
    promise: Promise<PlatformAppearanceRead>;
};

const MAX_READ_ATTEMPTS = 2;
const platformUnknownReasons = new Set<PlatformAppearanceUnknownReason>([
    'unsupported',
    'unavailable',
    'invalid',
    'error',
]);

export const unsupportedSystemAppearanceAdapter: PlatformAppearanceAdapter = {
    read: async () => ({status: 'unknown', reason: 'unsupported'}),
    subscribeInvalidation: () => () => undefined,
};

export class SystemAppearanceMonitor {
    private adapter: PlatformAppearanceAdapter;
    private adapterGeneration = 1;
    private revision = 1;
    private inFlight?: AppearanceRead;
    private listeners = new Set<(event: SystemAppearanceInvalidation) => void>();
    private unsubscribeAdapter: () => void;
    private destroyed = false;

    constructor(adapter: PlatformAppearanceAdapter = unsupportedSystemAppearanceAdapter) {
        this.adapter = adapter;
        this.unsubscribeAdapter = adapter.subscribeInvalidation(this.handleAdapterInvalidation);
    }

    getSystemAppearance = (): Promise<SystemAppearanceSnapshot> => {
        return this.readStableSnapshot(MAX_READ_ATTEMPTS);
    };

    private readStableSnapshot = async (attemptsRemaining: number): Promise<SystemAppearanceSnapshot> => {
        const revision = this.revision;
        const adapterGeneration = this.adapterGeneration;
        const result = await this.readForRevision(revision, adapterGeneration);

        if (revision === this.revision && adapterGeneration === this.adapterGeneration) {
            if (result.status === 'known') {
                return {revision, status: 'known', value: result.value};
            }

            return {revision, status: 'unknown', reason: result.reason};
        }

        if (attemptsRemaining > 1) {
            return this.readStableSnapshot(attemptsRemaining - 1);
        }

        return {
            revision: this.revision,
            status: 'unknown',
            reason: 'unstable',
        };
    };

    subscribeInvalidation = (listener: (event: SystemAppearanceInvalidation) => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    invalidate = (previousValueStatus: SystemAppearanceInvalidation['previousValueStatus']) => {
        this.revision += 1;
        this.inFlight = undefined;

        const event = {revision: this.revision, previousValueStatus};
        this.listeners.forEach((listener) => listener(event));
    };

    replaceAdapter = (adapter: PlatformAppearanceAdapter) => {
        this.unsubscribeAdapter();
        this.adapter = adapter;
        this.adapterGeneration += 1;
        this.invalidate('invalid');
        this.unsubscribeAdapter = adapter.subscribeInvalidation(this.handleAdapterInvalidation);
    };

    destroy = () => {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;
        this.unsubscribeAdapter();
        this.listeners.clear();
        this.inFlight = undefined;
    };

    private handleAdapterInvalidation = () => {
        this.invalidate('stale');
    };

    private readForRevision = (revision: number, adapterGeneration: number) => {
        if (this.inFlight?.revision === revision && this.inFlight.adapterGeneration === adapterGeneration) {
            return this.inFlight.promise;
        }

        const adapter = this.adapter;
        const promise = Promise.resolve().
            then(() => adapter.read()).
            then(normalizePlatformAppearanceRead, () => ({status: 'unknown' as const, reason: 'error' as const}));
        const inFlight = {revision, adapterGeneration, promise};
        this.inFlight = inFlight;
        promise.finally(() => {
            if (this.inFlight === inFlight) {
                this.inFlight = undefined;
            }
        });

        return promise;
    };
}

function normalizePlatformAppearanceRead(value: unknown): PlatformAppearanceRead {
    if (!value || typeof value !== 'object' || !('status' in value)) {
        return {status: 'unknown', reason: 'invalid'};
    }

    if (value.status === 'known' && 'value' in value && (value.value === 'light' || value.value === 'dark')) {
        return {status: 'known', value: value.value};
    }

    if (value.status === 'unknown' && 'reason' in value && platformUnknownReasons.has(value.reason as PlatformAppearanceUnknownReason)) {
        return {status: 'unknown', reason: value.reason as PlatformAppearanceUnknownReason};
    }

    return {status: 'unknown', reason: 'invalid'};
}

const systemAppearanceMonitor = new SystemAppearanceMonitor();
export default systemAppearanceMonitor;
