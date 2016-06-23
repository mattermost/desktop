const OriginalNotification = Notification;

function override(eventHandlers) {
  Notification = function(title, options) {
    // Notification Center shows app's icon, so there were two icons on the notification.
    if (process.platform === 'darwin') {
      delete options.icon;
    }
    this.notification = new OriginalNotification(title, options);
    if (eventHandlers.notification) {
      eventHandlers.notification(title, options);
    }
  };

  // static properties
  Notification.__defineGetter__('permission', function() {
    return OriginalNotification.permission;
  });

  // instance properties
  var defineReadProperty = function(property) {
    Notification.prototype.__defineGetter__(property, function() {
      return this.notification[property];
    });
  };
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
  var defineEventHandler = function(event, callback) {
    defineReadProperty(event);
    Notification.prototype.__defineSetter__(event, function(originalCallback) {
      this.notification[event] = function() {
        callbackevent = {
          preventDefault: function() {
            this.isPrevented = true;
          }
        };
        if (callback) {
          callback(callbackevent);
          if (!callbackevent.isPrevented) {
            originalCallback();
          }
        }
        else {
          originalCallback();
        }
      }
    });
  }
  defineEventHandler('onclick', eventHandlers.onclick);
  defineEventHandler('onerror', eventHandlers.onerror);

  // obsolete handlers
  defineEventHandler('onclose', eventHandlers.onclose);
  defineEventHandler('onshow', eventHandlers.onshow);

  // static methods
  Notification.requestPermission = function(callback) {
    OriginalNotification.requestPermission(callback);
  };

  // instance methods
  Notification.prototype.close = function() {
    this.notification.close();
  };
}

module.exports = {
  override: override
};
