// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import i18nManager, {I18nManager, localizeMessage} from 'main/i18nManager';

jest.mock('electron', () => ({
    ipcMain: {
        handle: jest.fn(),
    },
}));

jest.mock('electron-log', () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
}));

describe('main/i18nManager', () => {
    it('should default to English', () => {
        const i18n = new I18nManager();
        expect(i18n.currentLanguage.value).toBe('en');
    });

    it('should set locale only if available', () => {
        const i18n = new I18nManager();

        expect(i18n.setLocale('fr')).toBe(true);
        expect(i18n.currentLanguage.value).toBe('fr');
        expect(i18n.setLocale('zz')).toBe(false);
        expect(i18n.currentLanguage.value).toBe('fr');
    });
});

describe('main/i18nManager/localizeMessage', () => {
    i18nManager.currentLanguage = {
        url: {
            simple_key: 'simple_translation',
            simple_replace_key: 'simple_translation {key}',
            replace_two_key: '{replace} {replace_again}',
            nested_braces: '{{replace}}',
            multiple_same: '{replace} {replace} {key}',
        },
    };

    it('should get a simple translation', () => {
        expect(localizeMessage('simple_key', 'different_translation')).toBe('simple_translation');
    });

    it('should default if does not exist', () => {
        expect(localizeMessage('unsimple_key', 'different_translation')).toBe('different_translation');
    });

    it('should replace', () => {
        expect(localizeMessage('simple_replace_key', null, {key: 'replacement'})).toBe('simple_translation replacement');
    });

    it('should not replace if key is missing', () => {
        expect(localizeMessage('simple_replace_key', null, {})).toBe('simple_translation {key}');
    });

    it('should replace twice', () => {
        expect(localizeMessage('replace_two_key', null, {replace: 'replacement1', replace_again: 'replacement2'})).toBe('replacement1 replacement2');
    });

    it('should ignore nested braces', () => {
        expect(localizeMessage('nested_braces', null, {replace: 'replacement'})).toBe('{replacement}');
    });

    it('should replace multiple of the same', () => {
        expect(localizeMessage('multiple_same', null, {replace: 'replacement', key: 'key1'})).toBe('replacement replacement key1');
    });
});
