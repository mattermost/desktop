// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isRoutableAddress} from './utils';

jest.mock('electron', () => ({
    app: {},
}));

describe('main/utils', () => {
    describe('isRoutableAddress', () => {
        describe('IPv4', () => {
            it('accepts a public address', () => {
                expect(isRoutableAddress('IPv4', '203.0.113.5')).toBe(true);
            });

            it('accepts private addresses', () => {
                expect(isRoutableAddress('IPv4', '10.0.0.1')).toBe(true);
                expect(isRoutableAddress('IPv4', '192.168.1.100')).toBe(true);
                expect(isRoutableAddress('IPv4', '172.16.1.100')).toBe(true);
            });

            it('accepts CGNAT (Tailscale) addresses', () => {
                expect(isRoutableAddress('IPv4', '100.64.0.1')).toBe(true);
            });

            it('rejects link-local addresses', () => {
                expect(isRoutableAddress('IPv4', '169.254.10.20')).toBe(false);
            });

            it('rejects the unspecified address', () => {
                expect(isRoutableAddress('IPv4', '0.0.0.0')).toBe(false);
            });
        });

        describe('IPv6', () => {
            it('accepts a global unicast address', () => {
                expect(isRoutableAddress('IPv6', '2001:db8::1')).toBe(true);
            });

            it('accepts unique-local (Tailscale ULA) addresses', () => {
                expect(isRoutableAddress('IPv6', 'fd00::1')).toBe(true);
            });

            it('rejects link-local addresses', () => {
                expect(isRoutableAddress('IPv6', 'fe80::1')).toBe(false);
            });

            it('rejects link-local addresses regardless of case', () => {
                expect(isRoutableAddress('IPv6', 'FE80::1')).toBe(false);
            });

            it('rejects link-local addresses with a zone identifier', () => {
                expect(isRoutableAddress('IPv6', 'fe80::1%utun0')).toBe(false);
            });
        });
    });
});
