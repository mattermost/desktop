'use strict';

const Grid = ReactBootstrap.Grid;
const Row = ReactBootstrap.Row;
const Col = ReactBootstrap.Col;
const Nav = ReactBootstrap.Nav;
const NavItem = ReactBootstrap.NavItem;
const Badge = ReactBootstrap.Badge;

const electron = require('electron');
const remote = electron.remote;

const osLocale = require('os-locale');
const fs = require('fs');
const url = require('url');
const path = require('path');

const settings = require('../common/settings');

remote.getCurrentWindow().removeAllListeners('focus');

var MainPage = React.createClass({
  getInitialState: function() {
    return {
      key: 0,
      unreadCounts: new Array(this.props.teams.length),
      unreadAtActive: new Array(this.props.teams.length)
    };
  },
  componentDidMount: function() {
    var thisObj = this;
    var focusListener = function() {
      var webview = document.getElementById('mattermostView' + thisObj.state.key);
      webview.focus();

      thisObj.handleOnTeamFocused(thisObj.state.key);
    };

    var currentWindow = remote.getCurrentWindow();
    currentWindow.on('focus', focusListener);
    window.addEventListener('beforeunload', function() {
      currentWindow.removeListener('focus', focusListener);
    });
  },
  handleSelect: function(key) {
    this.setState({
      key: key
    });
    this.handleOnTeamFocused(key);
  },
  handleUnreadCountChange: function(index, count) {
    var counts = this.state.unreadCounts;
    counts[index] = count;
    this.setState({
      unreadCounts: counts
    });
    this.handleUnreadCountTotalChange();
  },
  handleUnreadAtActiveChange: function(index, state) {
    var unreadAtActive = this.state.unreadAtActive;
    unreadAtActive[index] = state;
    this.setState({
      unreadAtActive: unreadAtActive
    });
    this.handleUnreadCountTotalChange();
  },
  handleUnreadCountTotalChange: function() {
    if (this.props.onUnreadCountChange) {
      var c = this.state.unreadCounts.reduce(function(prev, curr) {
        return prev + curr;
      }, 0);
      this.state.unreadAtActive.forEach(function(state) {
        if (state) {
          c += 1;
        }
      });
      this.props.onUnreadCountChange(c);
    }
  },
  handleNotify: function(index) {
    // Never turn on the unreadAtActive flag at current focused tab.
    if (this.state.key === index && remote.getCurrentWindow().isFocused()) {
      return;
    }
    this.handleUnreadAtActiveChange(index, true);
  },
  handleOnTeamFocused: function(index) {
    // Turn off the flag to indicate whether unread message of active channel contains at current tab.
    this.handleUnreadAtActiveChange(index, false);
  },

  visibleStyle: function(visible) {
    var visibility = visible ? 'visible' : 'hidden';
    return {
      position: 'absolute',
      top: (this.props.teams.length > 1) ? 42 : 0,
      right: 0,
      bottom: 0,
      left: 0,
      visibility: visibility
    };
  },
  render: function() {
    var thisObj = this;

    var tabs_row;
    if (this.props.teams.length > 1) {
      tabs_row = (
        <Row>
          <TabBar id="tabBar" teams={ this.props.teams } unreadCounts={ this.state.unreadCounts } unreadAtActive={ this.state.unreadAtActive } activeKey={ this.state.key } onSelect={ this.handleSelect }></TabBar>
        </Row>
      );
    }

    var views = this.props.teams.map(function(team, index) {
      var handleUnreadCountChange = function(count) {
        thisObj.handleUnreadCountChange(index, count);
      };
      var handleNotify = function() {
        thisObj.handleNotify(index);
      };
      var handleNotificationClick = function() {
        thisObj.handleSelect(index);
      }
      return (<MattermostView id={ 'mattermostView' + index } style={ thisObj.visibleStyle(thisObj.state.key === index) } src={ team.url } onUnreadCountChange={ handleUnreadCountChange } onNotify={ handleNotify } onNotificationClick={ handleNotificationClick }
              />)
    });
    var views_row = (<Row>
                       { views }
                     </Row>);
    return (
      <Grid fluid>
        { tabs_row }
        { views_row }
      </Grid>
      );
  }
});

var TabBar = React.createClass({
  render: function() {
    var thisObj = this;
    var tabs = this.props.teams.map(function(team, index) {
      var badge;
      var unreadCount = 0;
      if (thisObj.props.unreadCounts[index] > 0) {
        unreadCount = thisObj.props.unreadCounts[index];
      }
      if (thisObj.props.unreadAtActive[index]) {
        unreadCount += 1;
      }
      if (unreadCount > 0) {
        badge = (<Badge>
                   { unreadCount }
                 </Badge>);
      }
      return (<NavItem className="teamTabItem" id={ 'teamTabItem' + index } eventKey={ index }>
                { team.name }
                { ' ' }
                { badge }
              </NavItem>);
    });
    return (
      <Nav id={ this.props.id } bsStyle="tabs" activeKey={ this.props.activeKey } onSelect={ this.props.onSelect }>
        { tabs }
      </Nav>
      );
  }
});

var MattermostView = React.createClass({
  handleUnreadCountChange: function(count) {
    if (this.props.onUnreadCountChange) {
      this.props.onUnreadCountChange(count);
    }
  },

  handleNotify: function() {
    if (this.props.onNotify) {
      this.props.onNotify();
    }
  },

  componentDidMount: function() {
    var thisObj = this;
    var webview = ReactDOM.findDOMNode(this.refs.webview);

    // Open link in browserWindow. for exmaple, attached files.
    webview.addEventListener('new-window', function(e) {
      var currentURL = url.parse(webview.getURL());
      var destURL = url.parse(e.url);
      if (currentURL.host === destURL.host) {
        window.open(e.url, 'electron-mattermost');
      } else {
        // if the link is external, use default browser.
        require('shell').openExternal(e.url);
      }
    });

    webview.addEventListener("dom-ready", function() {
      // webview.openDevTools();

      // Use 'Meiryo UI' and 'MS Gothic' to prevent CJK fonts on Windows(JP).
      if (process.platform === 'win32') {
        var applyCssFile = function(cssFile) {
          fs.readFile(cssFile, 'utf8', function(err, data) {
            if (err) {
              console.log(err);
              return;
            }
            webview.insertCSS(data);
          });
        };

        osLocale(function(err, locale) {
          if (err) {
            console.log(err);
            return;
          }
          if (locale === 'ja_JP') {
            applyCssFile(__dirname + '/css/jp_fonts.css');
          }
        });
      }
    });

    webview.addEventListener('ipc-message', function(event) {
      switch (event.channel) {
        case 'onUnreadCountChange':
          var unreadCount = event.args[0];
          thisObj.handleUnreadCountChange(unreadCount);
          break;
        case 'onNotificationClick':
          thisObj.props.onNotificationClick();
          break;
        case 'onActiveChannelNotify':
          thisObj.handleNotify();
          break;
      }
    });
  },
  render: function() {
    // 'disablewebsecurity' is necessary to display external images.
    // However, it allows also CSS/JavaScript.
    // So webview should use 'allowDisplayingInsecureContent' as same as BrowserWindow.
    return (<webview id={ this.props.id } className="mattermostView" style={ this.props.style } preload="webview/mattermost.js" src={ this.props.src } ref="webview"></webview>);
  }
});

var config;
try {
  var configFile = remote.getGlobal('config-file');
  config = settings.readFileSync(configFile);
} catch (e) {
  window.location = 'settings.html';
}
if (config.teams.length === 0) {
  window.location = 'settings.html';
}

var contextMenu = require('./menus/context');
var menu = contextMenu.createDefault();
window.addEventListener('contextmenu', function(e) {
  menu.popup(remote.getCurrentWindow());
}, false);

var showUnreadBadge = function(unreadCount) {
  switch (process.platform) {
    case 'win32':
      var window = remote.getCurrentWindow();
      if (unreadCount > 0) {
        window.setOverlayIcon(path.join(__dirname, '../resources/badge.png'), 'You have unread channels.');
      } else {
        window.setOverlayIcon(null, '');
      }
      break;
    case 'darwin':
      if (unreadCount > 0) {
        remote.app.dock.setBadge(unreadCount.toString());
      } else {
        remote.app.dock.setBadge('');
      }
      break;
    default:
  }
}

ReactDOM.render(
  <MainPage teams={ config.teams } onUnreadCountChange={ showUnreadBadge } />,
  document.getElementById('content')
);
