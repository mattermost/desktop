// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import EventEmitter from 'events';

import simpleSpellChecker from 'simple-spellchecker';

/// Following approach for contractions is derived from electron-spellchecker.

// NB: This is to work around electron/electron#1005, where contractions
// are incorrectly marked as spelling errors. This lets people get away with
// incorrectly spelled contracted words, but it's the best we can do for now.
const contractions = [
  "ain't", "aren't", "can't", "could've", "couldn't", "couldn't've", "didn't", "doesn't", "don't", "hadn't",
  "hadn't've", "hasn't", "haven't", "he'd", "he'd've", "he'll", "he's", "how'd", "how'll", "how's", "I'd",
  "I'd've", "I'll", "I'm", "I've", "isn't", "it'd", "it'd've", "it'll", "it's", "let's", "ma'am", "mightn't",
  "mightn't've", "might've", "mustn't", "must've", "needn't", "not've", "o'clock", "shan't", "she'd", "she'd've",
  "she'll", "she's", "should've", "shouldn't", "shouldn't've", "that'll", "that's", "there'd", "there'd've",
  "there're", "there's", "they'd", "they'd've", "they'll", "they're", "they've", "wasn't", "we'd", "we'd've",
  "we'll", "we're", "we've", "weren't", "what'll", "what're", "what's", "what've", "when's", "where'd",
  "where's", "where've", "who'd", "who'll", "who're", "who's", "who've", "why'll", "why're", "why's", "won't",
  "would've", "wouldn't", "wouldn't've", "y'all", "y'all'd've", "you'd", "you'd've", "you'll", "you're", "you've",
];

const contractionMap = contractions.reduce((acc, word) => {
  acc[word.replace(/'.*/, '')] = true;
  return acc;
}, {});

/// End: derived from electron-spellchecker.

export default class SpellChecker extends EventEmitter {
  constructor(locale, dictDir, callback) {
    super();
    this.dict = null;
    this.locale = locale;
    simpleSpellChecker.getDictionary(locale, dictDir, (err, dict) => {
      if (err) {
        this.emit('error', err);
        if (callback) {
          callback(err);
        }
      } else {
        this.dict = dict;
        this.emit('ready');
        if (callback) {
          callback(null, this);
        }
      }
    });
  }

  isReady() {
    return this.dict !== null;
  }

  spellCheck(word) {
    if (word.toLowerCase() === 'mattermost') {
      return true;
    }
    if (isFinite(word)) { // Numerals are not included in the dictionary
      return true;
    }
    if (this.locale.match(/^en-?/) && contractionMap[word]) {
      return true;
    }
    return this.dict.spellCheck(word);
  }

  getSuggestions(word, maxSuggestions) {
    const suggestions = this.dict.getSuggestions(word, maxSuggestions);

    const firstCharWord = word.charAt(0);
    let i;
    for (i = 0; i < suggestions.length; i++) {
      if (suggestions[i].charAt(0).toUpperCase() === firstCharWord.toUpperCase()) {
        suggestions[i] = firstCharWord + suggestions[i].slice(1);
      }
    }

    const uniqueSuggestions = suggestions.reduce((a, b) => {
      if (a.indexOf(b) < 0) {
        a.push(b);
      }
      return a;
    }, []);

    return uniqueSuggestions;
  }
}

SpellChecker.getSpellCheckerLocale = (electronLocale) => {
  if (electronLocale.match(/^en-?/)) {
    return 'en-US';
  }
  if (electronLocale.match(/^fr-?/)) {
    return 'fr-FR';
  }
  if (electronLocale.match(/^de-?/)) {
    return 'de-DE';
  }
  if (electronLocale.match(/^es-?/)) {
    return 'es-ES';
  }
  if (electronLocale.match(/^nl-?/)) {
    return 'nl-NL';
  }
  if (electronLocale.match(/^pl-?/)) {
    return 'pl-PL';
  }
  if (electronLocale.match(/^pt-?/)) {
    return 'pt-BR';
  }
  if (electronLocale.match(/^it-?/)) {
    return 'it-IT';
  }
  if (electronLocale.match(/^ru-?/)) {
    return 'ru-RU';
  }
  if (electronLocale.match(/^uk-?/)) {
    return 'uk-UA';
  }
  return 'en-US';
};
