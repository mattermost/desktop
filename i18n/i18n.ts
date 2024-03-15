// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import bg from './bg.json';
import de from './de.json';
import en from './en.json';
import enAU from './en_AU.json';
import es from './es.json';
import fa from './fa.json';
import fr from './fr.json';
import hu from './hu.json';
import it from './it.json';
import ja from './ja.json';
import ko from './ko.json';
import nl from './nl.json';
import pl from './pl.json';
import ptBR from './pt-BR.json';
import ro from './ro.json';
import ru from './ru.json';
import sv from './sv.json';
import tr from './tr.json';
import uk from './uk.json';
import vi from './vi.json';
import zhCN from './zh-CN.json';
import zhTW from './zh-TW.json';

export type Language = {
    value: string;
    name: string;
    order: number;
    url: Record<string, string>;
};

export const languages: Record<string, Language> = {
    de: {
        value: 'de',
        name: 'Deutsch',
        order: 0,
        url: de,
    },
    en: {
        value: 'en',
        name: 'English (US)',
        order: 1,
        url: en,
    },
    'en-AU': {
        value: 'en-AU',
        name: 'English (Australia)',
        order: 2,
        url: enAU,
    },
    es: {
        value: 'es',
        name: 'Español',
        order: 3,
        url: es,
    },
    fr: {
        value: 'fr',
        name: 'Français',
        order: 4,
        url: fr,
    },
    it: {
        value: 'it',
        name: 'Italiano (Alpha)',
        order: 5,
        url: it,
    },
    hu: {
        value: 'hu',
        name: 'Magyar',
        order: 6,
        url: hu,
    },
    nl: {
        value: 'nl',
        name: 'Nederlands',
        order: 7,
        url: nl,
    },
    pl: {
        value: 'pl',
        name: 'Polski',
        order: 8,
        url: pl,
    },
    'pt-BR': {
        value: 'pt-BR',
        name: 'Português (Brasil) (Beta)',
        order: 9,
        url: ptBR,
    },
    ro: {
        value: 'ro',
        name: 'Română (Beta)',
        order: 10,
        url: ro,
    },
    sv: {
        value: 'sv',
        name: 'Svenska',
        order: 11,
        url: sv,
    },
    vi: {
        value: 'vi',
        name: 'Tiếng Việt (Beta)',
        order: 12,
        url: vi,
    },
    tr: {
        value: 'tr',
        name: 'Türkçe',
        order: 13,
        url: tr,
    },
    bg: {
        value: 'bg',
        name: 'Български',
        order: 14,
        url: bg,
    },
    ru: {
        value: 'ru',
        name: 'Pусский',
        order: 15,
        url: ru,
    },
    uk: {
        value: 'uk',
        name: 'Yкраїнська (Alpha)',
        order: 16,
        url: uk,
    },
    fa: {
        value: 'fa',
        name: 'فارسی (Beta)',
        order: 17,
        url: fa,
    },
    ko: {
        value: 'ko',
        name: '한국어 (Alpha)',
        order: 18,
        url: ko,
    },
    'zh-CN': {
        value: 'zh-CN',
        name: '中文 (简体) (Beta)',
        order: 19,
        url: zhCN,
    },
    'zh-TW': {
        value: 'zh-TW',
        name: '中文 (繁體)',
        order: 20,
        url: zhTW,
    },
    ja: {
        value: 'ja',
        name: '日本語',
        order: 21,
        url: ja,
    },
};
