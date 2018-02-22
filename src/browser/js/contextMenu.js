const {ipcRenderer} = require('electron');
const electronContextMenu = require('electron-context-menu');

function getSuggestionsMenus(win, suggestions) {
  if (suggestions.length === 0) {
    return [{
      label: 'No Suggestions',
      enabled: false,
    }];
  }
  return suggestions.map((s) => ({
    label: s,
    click() {
      (win.webContents || win.getWebContents()).replaceMisspelling(s);
    },
  }));
}

function getSpellCheckerLocaleMenus(onSelectSpellCheckerLocale) {
  const currentLocale = ipcRenderer.sendSync('get-spellchecker-locale');
  const locales = [
    {language: 'English', locale: 'en-US'},
    {language: 'French', locale: 'fr-FR'},
    {language: 'German', locale: 'de-DE'},
    {language: 'Spanish', locale: 'es-ES'},
    {language: 'Dutch', locale: 'nl-NL'},
  ];
  return locales.map((l) => ({
    label: l.language,
    type: 'checkbox',
    checked: l.locale === currentLocale,
    click() {
      if (onSelectSpellCheckerLocale) {
        onSelectSpellCheckerLocale(l.locale);
      }
    },
  }));
}

module.exports = {
  setup(win, options) {
    const defaultOptions = {
      useSpellChecker: false,
      onSelectSpellCheckerLocale: null,
    };
    const actualOptions = Object.assign({}, defaultOptions, options);
    electronContextMenu({
      window: win,
      prepend(params) {
        if (actualOptions.useSpellChecker) {
          const prependMenuItems = [];
          if (params.isEditable && params.misspelledWord !== '') {
            const suggestions = ipcRenderer.sendSync('get-spelling-suggestions', params.misspelledWord);
            prependMenuItems.push(...getSuggestionsMenus(win, suggestions));
          }
          if (params.isEditable) {
            prependMenuItems.push(
              {type: 'separator'},
              {label: 'Spelling Languages', submenu: getSpellCheckerLocaleMenus(actualOptions.onSelectSpellCheckerLocale)});
          }
          return prependMenuItems;
        }
        return [];
      },
    });
  },
};
