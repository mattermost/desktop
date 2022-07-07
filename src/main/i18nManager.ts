// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app, ipcMain} from 'electron';
import log from 'electron-log';

import {GET_LANGUAGE_INFORMATION} from 'common/communication';

import {Language, languages} from '../../i18n/i18n';

export function t(s: string, defaultString = '', values: any = {}) {
    let str = i18nManager.currentLanguage.url[s] || defaultString;
    for (const key of Object.keys(values)) {
        str = str.replace(`{${key}}`, values[key]);
    }
    return str;
}

class I18nManager {
    currentLanguage: Language;

    constructor() {
        this.currentLanguage = this.getLanguages().en;

        if (!this.setLocale(app.getLocale())) {
            this.setLocale(app.getLocaleCountryCode());
        }

        ipcMain.handle(GET_LANGUAGE_INFORMATION, this.getCurrentLanguage);
    }

    setLocale = (locale: string) => {
        log.debug('i18nManager.setLocale', locale);

        if (this.isLanguageAvailable(locale)) {
            this.currentLanguage = this.getLanguages()[locale];
            log.info('Set new language', locale);
            return true;
        }

        log.warn('Failed to set new language', locale);
        return false;
    }

    getLanguages = () => {
        return languages;
    }

    isLanguageAvailable = (locale: string) => {
        return Boolean(this.getLanguages()[locale]);
    }

    getCurrentLanguage = () => {
        return this.currentLanguage;
    }
}

const i18nManager = new I18nManager();
export default i18nManager;

// export function getLanguages() {
//     const config = getConfig(store.getState());
//     if (!config.AvailableLocales) {
//         return getAllLanguages();
//     }
//     return config.AvailableLocales.split(',').reduce((result, l) => {
//         if (languages[l]) {
//             result[l] = languages[l];
//         }
//         return result;
//     }, {});
// }

// export function getLanguageInfo(locale) {
//     return getAllLanguages()[locale];
// }

// export function isLanguageAvailable(locale) {
//     return Boolean(getLanguages()[locale]);
// }
