'use strict';

const OriginalNotification = Notification;
const {remote} = require('electron');

const appIconURL = `file:///${remote.app.getAppPath()}/assets/appicon.png`;

function override(eventHandlers) {
  Notification = function constructor(title, options) { // eslint-disable-line no-global-assign, no-native-reassign
    if (process.platform === 'win32') {
      // Replace with application icon.
      options.icon = appIconURL;
    } else if (process.platform === 'darwin') {
      // Notification Center shows app's icon, so there were two icons on the notification.
      Reflect.deleteProperty(options, 'icon');
    }
    this.notification = new OriginalNotification(title, options);
    if (eventHandlers.notification) {
      eventHandlers.notification(title, options);
    }
  };

  // static properties
  Notification.__defineGetter__('permission', () => {
    return OriginalNotification.permission;
  });

  // instance properties
  function defineReadProperty(property) {
    Notification.prototype.__defineGetter__(property, function getter() {
      return this.notification[property];
    });
  }
  defineReadProperty('title');
  defineReadProperty('dir');
  defineReadProperty('lang');
  defineReadProperty('body');
  defineReadProperty('tag');
  defineReadProperty('icon');
  defineReadProperty('data');
  defineReadProperty('silent');

  // unsupported properties
  defineReadProperty('noscreen');
  defineReadProperty('renotify');
  defineReadProperty('sound');
  defineReadProperty('sticky');
  defineReadProperty('vibrate');

  // event handlers
  function defineEventHandler(event, callback) {
    defineReadProperty(event);
    Notification.prototype.__defineSetter__(event, function setter(originalCallback) {
      this.notification[event] = () => {
        const callbackevent = {
          preventDefault() {
            this.isPrevented = true;
          }
        };
        if (callback) {
          callback(callbackevent);
          if (!callbackevent.isPrevented) {
            originalCallback();
          }
        } else {
          originalCallback();
        }
      };
    });
  }
  defineEventHandler('onclick', eventHandlers.onclick);
  defineEventHandler('onerror', eventHandlers.onerror);

  // obsolete handlers
  defineEventHandler('onclose', eventHandlers.onclose);
  defineEventHandler('onshow', eventHandlers.onshow);

  // static methods
  Notification.requestPermission = (callback) => {
    OriginalNotification.requestPermission(callback);
  };

  // instance methods
  Notification.prototype.close = function close() {
    this.notification.close();
  };
}

module.exports = {
  override
};
