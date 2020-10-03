// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import path from 'path';

import SpellChecker from '../../src/main/SpellChecker';

describe('main/Spellchecker.js', function() {
  describe('getSpellCheckerLocale()', () => {
    it('should return recognized locale', () => {
      SpellChecker.getSpellCheckerLocale('en').should.equal('en-US');
      SpellChecker.getSpellCheckerLocale('en-US').should.equal('en-US');

      SpellChecker.getSpellCheckerLocale('fr').should.equal('fr-FR');
      SpellChecker.getSpellCheckerLocale('fr-FR').should.equal('fr-FR');

      SpellChecker.getSpellCheckerLocale('de').should.equal('de-DE');
      SpellChecker.getSpellCheckerLocale('de-DE').should.equal('de-DE');

      SpellChecker.getSpellCheckerLocale('es').should.equal('es-ES');
      SpellChecker.getSpellCheckerLocale('es-ES').should.equal('es-ES');

      SpellChecker.getSpellCheckerLocale('nl').should.equal('nl-NL');
      SpellChecker.getSpellCheckerLocale('nl-NL').should.equal('nl-NL');

      SpellChecker.getSpellCheckerLocale('pl').should.equal('pl-PL');
      SpellChecker.getSpellCheckerLocale('pl-PL').should.equal('pl-PL');
      SpellChecker.getSpellCheckerLocale('pt').should.equal('pt-BR');
      SpellChecker.getSpellCheckerLocale('pt-BR').should.equal('pt-BR');

      SpellChecker.getSpellCheckerLocale('ja').should.equal('en-US');
      SpellChecker.getSpellCheckerLocale('ja-JP').should.equal('en-US');

      SpellChecker.getSpellCheckerLocale('it').should.equal('it-IT');
      SpellChecker.getSpellCheckerLocale('it-IT').should.equal('it-IT');

      SpellChecker.getSpellCheckerLocale('ru').should.equal('ru-RU');
      SpellChecker.getSpellCheckerLocale('ru-RU').should.equal('ru-RU');

      SpellChecker.getSpellCheckerLocale('uk').should.equal('uk-UA');
      SpellChecker.getSpellCheckerLocale('uk-UA').should.equal('uk-UA');
    });
  });

  describe('en-US', function() {
    let spellchecker = null;

    before(function(done) {
      spellchecker = new SpellChecker(
        'en-US',
        path.resolve(__dirname, '../../src/node_modules/simple-spellchecker/dict'),
        done
      );
    });

    it('should spellcheck', function() {
    // https://github.com/jfmdev/simple-spellchecker/issues/3
      spellchecker.spellCheck('spell').should.equal(true);
      spellchecker.spellCheck('spel').should.equal(false);
      spellchecker.spellCheck('December').should.equal(true);
      spellchecker.spellCheck('december').should.equal(true);
      spellchecker.spellCheck('English').should.equal(true);
      spellchecker.spellCheck('Japan').should.equal(true);
    });

    it('should allow contractions', function() {
      spellchecker.spellCheck("shouldn't").should.equal(true);
      spellchecker.spellCheck('shouldn').should.equal(true);
    });

    it('should allow numerals', function() {
      spellchecker.spellCheck('1').should.equal(true);
      spellchecker.spellCheck('-100').should.equal(true);
      spellchecker.spellCheck('3.14').should.equal(true);
    });

    it('should allow "Mattermost"', function() {
      spellchecker.spellCheck('Mattermost').should.equal(true);
      spellchecker.spellCheck('mattermost').should.equal(true);
    });

    it('should give at most the requested number of suggestions', function() {
      // helllo known to give at least 4 suggestions
      spellchecker.getSuggestions('helllo', 4).length.should.be.equal(4);
      spellchecker.getSuggestions('helllo', 1).length.should.be.equal(1);
    });

    it('should give suggestions which preserve case of first letter', function() {
      let suggestions = spellchecker.getSuggestions('carr', 4);
      suggestions.length.should.not.be.equal(0);
      let i;
      for (i = 0; i < suggestions.length; i++) {
        suggestions[i].charAt(0).should.be.equal('c');
      }

      suggestions = spellchecker.getSuggestions('Carr', 4);
      suggestions.length.should.not.be.equal(0);
      for (i = 0; i < suggestions.length; i++) {
        suggestions[i].charAt(0).should.be.equal('C');
      }
    });
  });

  describe('en-GB', function() {
    let spellchecker = null;

    before(function(done) {
      spellchecker = new SpellChecker(
        'en-GB',
        path.resolve(__dirname, '../../src/node_modules/simple-spellchecker/dict'),
        done
      );
    });

    it('should allow contractions', function() {
      spellchecker.spellCheck("shouldn't").should.equal(true);
      spellchecker.spellCheck('shouldn').should.equal(true);
    });
  });

  describe('ru-RU', function() {
    let spellchecker = null;

    before(function(done) {
      spellchecker = new SpellChecker(
        'ru-RU',
        path.resolve(__dirname, '../../src/node_modules/simple-spellchecker/dict'),
        done
      );
    });

    it('should spellcheck', function() {
      spellchecker.spellCheck('русский').should.equal(true);
    });
    it('should give suggestions', function() {
      spellchecker.getSuggestions('руский', 1).length.should.be.equal(1);
    });
  });

  describe('uk-UA', function() {
    let spellchecker = null;

    before(function(done) {
      spellchecker = new SpellChecker(
        'uk-UA',
        path.resolve(__dirname, '../../src/node_modules/simple-spellchecker/dict'),
        done
      );
    });

    it('should spellcheck', function() {
      spellchecker.spellCheck('українська').should.equal(true);
    });
    it('should give suggestions', function() {
      spellchecker.getSuggestions('украінська', 1).length.should.be.equal(1);
    });
  });

  describe('de-DE', function() {
    let spellchecker = null;

    before(function(done) {
      spellchecker = new SpellChecker(
        'de-DE',
        path.resolve(__dirname, '../../src/node_modules/simple-spellchecker/dict'),
        done
      );
    });

    it('should spellcheck', function() {
      spellchecker.spellCheck('Guten').should.equal(true);
      spellchecker.spellCheck('tag').should.equal(true);
    });

    it('should allow numerals', function() {
      spellchecker.spellCheck('1').should.equal(true);
      spellchecker.spellCheck('-100').should.equal(true);
      spellchecker.spellCheck('3.14').should.equal(true);
    });

    it('should give suggestions which preserve case of first letter', function() {
      let suggestions = spellchecker.getSuggestions('gutenn', 4);
      suggestions.length.should.not.be.equal(0);
      let i;
      for (i = 0; i < suggestions.length; i++) {
        suggestions[i].charAt(0).should.be.equal('g');
      }

      suggestions = spellchecker.getSuggestions('Gutenn', 4);
      suggestions.length.should.not.be.equal(0);
      for (i = 0; i < suggestions.length; i++) {
        suggestions[i].charAt(0).should.be.equal('G');
      }
    });
  });
});
