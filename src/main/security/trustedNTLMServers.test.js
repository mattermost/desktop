// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import fs from 'fs';

import {TrustedNTLMServers} from './trustedNTLMServers';

jest.mock('electron', () => ({
    ipcMain: {
        on: jest.fn(),
    },
}));

jest.mock('fs', () => ({
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
}));

describe('main/security/trustedNTLMServers', () => {
    beforeEach(() => {
        fs.readFileSync.mockReturnValue('[]');
        fs.writeFileSync.mockClear();
    });

    it('should start empty when the store file is missing or unreadable', () => {
        fs.readFileSync.mockImplementation(() => {
            throw new Error('missing');
        });
        const store = new TrustedNTLMServers('someFile');
        expect(store.getHostnames()).toEqual([]);
    });

    it('should load persisted hostnames', () => {
        fs.readFileSync.mockReturnValue(JSON.stringify(['ntlm.example.org']));
        const store = new TrustedNTLMServers('someFile');
        expect(store.isTrusted(new URL('https://ntlm.example.org/foo'))).toBe(true);
        expect(store.isTrusted(new URL('https://other.example.org'))).toBe(false);
    });

    it('should add, persist and emit when trusting a new domain', () => {
        const store = new TrustedNTLMServers('someFile');
        const listener = jest.fn();
        store.on('trusted-ntlm-servers-updated', listener);

        store.add(new URL('https://ntlm.example.org:8443/path'));

        expect(store.isTrusted(new URL('https://ntlm.example.org'))).toBe(true);
        expect(store.getHostnames()).toEqual(['ntlm.example.org']);
        expect(fs.writeFileSync).toHaveBeenCalled();
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should not emit again when the domain is already trusted', () => {
        const store = new TrustedNTLMServers('someFile');
        const listener = jest.fn();
        store.on('trusted-ntlm-servers-updated', listener);

        store.add(new URL('https://ntlm.example.org'));
        store.add(new URL('https://ntlm.example.org'));

        expect(listener).toHaveBeenCalledTimes(1);
    });
});
