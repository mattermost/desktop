// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcMain} from 'electron';

import {GET_AVAILABLE_LANGUAGES, GET_LANGUAGE_INFORMATION} from 'common/communication';
import {Logger} from 'common/log';

import type {Language} from '../../i18n/i18n';
import {languages} from '../../i18n/i18n';

export function localizeMessage(s: string, defaultString = '', values: any = {}) {
    let str = i18nManager.currentLanguage.url[s] || defaultString;
    for (const key of Object.keys(values)) {
        str = str.replace(new RegExp(`{${key}}`, 'g'), values[key]);
    }
    return str;
}

const log = new Logger('i18nManager');

export class I18nManager {
    currentLanguage: Language;

    constructor() {
        this.currentLanguage = this.getLanguages().en;

        ipcMain.handle(GET_LANGUAGE_INFORMATION, this.getCurrentLanguage);
        ipcMain.handle(GET_AVAILABLE_LANGUAGES, this.getAvailableLanguages);
    }

    setLocale = (locale: string) => {
        log.debug('setLocale', locale);

        if (this.isLanguageAvailable(locale)) {
            this.currentLanguage = this.getLanguages()[locale];
            log.info('Set new language', locale);
            return true;
        }

        log.warn('Failed to set new language', locale);
        return false;
    };

    getLanguages = () => {
        return languages;
    };

    getAvailableLanguages = () => {
        return Object.keys(languages);
    };

    isLanguageAvailable = (locale: string) => {
        return Boolean(this.getLanguages()[locale]);
    };

    getCurrentLanguage = () => {
        return this.currentLanguage;
    };
}

const i18nManager = new I18nManager();
export default i18nManager;
