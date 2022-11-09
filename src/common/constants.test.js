// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {REGEX_EMAIL} from './constants';

const VALID_EMAILS_LIST = [
    ['email@example.com'],
    ['firstname.lastname@example.com'],
    ['disposable.style.email.with+symbol@example.com'],
    ['other.email-with-hyphen@example.com'],
    ['fully-qualified-domain@example.com'],
    ['user.name+tag+sorting@example.com'],
    ['x@example.com'],
    ['example-indeed@strange-example.com'],
    ['test/test@test.com'],
    ['admin@mailserver1'],
    ['example@s.example'],
    ['john..doe@example.org'],
    ['mailhost!username@example.org'],
    ['user%example.com@example.org'],
    ['user-@example.org'],
    ['email@subdomain.example.com'],
    ['firstname+lastname@example.com'],
    ['email@123.123.123.123'],
    ['1234567890@example.com'],
    ['email@example-one.com'],
    ['_______@example.com'],
    ['email@example.name'],
    ['email@example.museum'],
    ['email@example.co.jp'],
    ['firstname-lastname@example.com'],
];

const INVALID_EMAILS_LIST = [
    ['Abc.example.com'],
    ['QA[icon]CHOCOLATE[icon]@test.com'],
];

describe('main/common/constants', () => {
    describe('Email regular expression', () => {
        it.each(VALID_EMAILS_LIST)('%#:Should be VALID email address: %s', (a) => {
            expect(REGEX_EMAIL.test(a)).toBe(true);
        });

        it.each(INVALID_EMAILS_LIST)('%#: Should be INVALID email address: %s', (a) => {
            expect(REGEX_EMAIL.test(a)).toBe(false);
        });
    });
});
