const path = require('path');

const SpellChecker = require('../../src/main/SpellChecker');

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

      SpellChecker.getSpellCheckerLocale('ja').should.equal('en-US');
      SpellChecker.getSpellCheckerLocale('ja-JP').should.equal('en-US');
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
  });
});
