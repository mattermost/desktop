// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PlatformAppearanceAdapter, PlatformAppearanceRead} from './systemAppearanceMonitor';
import {SystemAppearanceMonitor} from './systemAppearanceMonitor';

type Deferred<T> = {
    promise: Promise<T>;
    resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((resolver) => {
        resolve = resolver;
    });
    return {promise, resolve};
}

function createAdapter(read: jest.Mock<Promise<PlatformAppearanceRead>, []>) {
    let invalidate: () => void = () => undefined;
    const unsubscribe = jest.fn();
    const adapter: PlatformAppearanceAdapter = {
        read,
        subscribeInvalidation: jest.fn((listener) => {
            invalidate = listener;
            return unsubscribe;
        }),
    };
    return {adapter, invalidate: () => invalidate(), unsubscribe};
}

describe('SystemAppearanceMonitor', () => {
    it('reports unsupported without a qualified adapter', async () => {
        const monitor = new SystemAppearanceMonitor();

        await expect(monitor.getSystemAppearance()).resolves.toEqual({
            revision: 1,
            status: 'unknown',
            reason: 'unsupported',
        });
    });

    it('coalesces concurrent reads for one revision', async () => {
        const pending = deferred<PlatformAppearanceRead>();
        const {adapter} = createAdapter(jest.fn(() => pending.promise));
        const monitor = new SystemAppearanceMonitor(adapter);

        const first = monitor.getSystemAppearance();
        const second = monitor.getSystemAppearance();
        pending.resolve({status: 'known', value: 'dark'});

        await expect(first).resolves.toEqual({revision: 1, status: 'known', value: 'dark'});
        await expect(second).resolves.toEqual({revision: 1, status: 'known', value: 'dark'});
        expect(adapter.read).toHaveBeenCalledTimes(1);
    });

    it('publishes an incremented revision without an appearance value', () => {
        const {adapter, invalidate} = createAdapter(jest.fn(async (): Promise<PlatformAppearanceRead> => ({status: 'known', value: 'light'})));
        const monitor = new SystemAppearanceMonitor(adapter);
        const listener = jest.fn();
        monitor.subscribeInvalidation(listener);

        invalidate();

        expect(listener).toHaveBeenCalledWith({revision: 2, previousValueStatus: 'stale'});
    });

    it('retries a read that overlaps an invalidation', async () => {
        const stale = deferred<PlatformAppearanceRead>();
        const read = jest.fn().
            mockImplementationOnce(() => stale.promise).
            mockResolvedValueOnce({status: 'known', value: 'dark'});
        const {adapter, invalidate} = createAdapter(read);
        const monitor = new SystemAppearanceMonitor(adapter);

        const result = monitor.getSystemAppearance();
        invalidate();
        stale.resolve({status: 'known', value: 'light'});

        await expect(result).resolves.toEqual({revision: 2, status: 'known', value: 'dark'});
        expect(read).toHaveBeenCalledTimes(2);
    });

    it('settles as unstable when every bounded read becomes stale', async () => {
        const first = deferred<PlatformAppearanceRead>();
        const second = deferred<PlatformAppearanceRead>();
        const secondStarted = deferred<void>();
        const read = jest.fn().
            mockImplementationOnce(() => first.promise).
            mockImplementationOnce(() => {
                secondStarted.resolve();
                return second.promise;
            });
        const {adapter, invalidate} = createAdapter(read);
        const monitor = new SystemAppearanceMonitor(adapter);

        const result = monitor.getSystemAppearance();
        invalidate();
        first.resolve({status: 'known', value: 'light'});
        await secondStarted.promise;
        invalidate();
        second.resolve({status: 'known', value: 'dark'});

        await expect(result).resolves.toEqual({revision: 3, status: 'unknown', reason: 'unstable'});
    });

    it('invalidates the previous value and drops old adapter work on replacement', async () => {
        const stale = deferred<PlatformAppearanceRead>();
        const oldAdapter = createAdapter(jest.fn(() => stale.promise));
        const newAdapter = createAdapter(jest.fn(async (): Promise<PlatformAppearanceRead> => ({status: 'known', value: 'dark'})));
        const monitor = new SystemAppearanceMonitor(oldAdapter.adapter);
        const listener = jest.fn();
        monitor.subscribeInvalidation(listener);

        const result = monitor.getSystemAppearance();
        monitor.replaceAdapter(newAdapter.adapter);
        stale.resolve({status: 'known', value: 'light'});

        await expect(result).resolves.toEqual({revision: 2, status: 'known', value: 'dark'});
        expect(oldAdapter.unsubscribe).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith({revision: 2, previousValueStatus: 'invalid'});
    });

    it.each([
        [async () => ({status: 'known', value: 'blue'}), 'invalid'],
        [async () => Promise.reject(new Error('read failed')), 'error'],
    ])('maps invalid and failed adapter reads to unknown', async (read, reason) => {
        const {adapter} = createAdapter(jest.fn(read) as jest.Mock<Promise<PlatformAppearanceRead>, []>);
        const monitor = new SystemAppearanceMonitor(adapter);

        await expect(monitor.getSystemAppearance()).resolves.toEqual({revision: 1, status: 'unknown', reason});
    });
});
