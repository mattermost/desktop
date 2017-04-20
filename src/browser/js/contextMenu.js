const {ipcRenderer} = require('electron');
const electronContextMenu = require('electron-context-menu');

function getSuggestionsMenus(win, suggestions) {
  return suggestions.map((s) => ({
    label: s,
    click() {
      (win.webContents || win.getWebContents()).replaceMisspelling(s);
    }
  }));
}

module.exports = {
  setup(win) {
    electronContextMenu({
      window: win,
      prepend(params) {
        if (params.isEditable && params.misspelledWord !== '') {
          const suggestions = ipcRenderer.sendSync('get-spelling-suggestions', params.misspelledWord);
          return getSuggestionsMenus(win, suggestions);
        }
        return [];
      }
    });
  }
};
