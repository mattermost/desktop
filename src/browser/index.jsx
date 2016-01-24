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
      mentionCounts: new Array(this.props.teams.length),
      unreadAtActive: new Array(this.props.teams.length),
      mentionAtActive: new Array(this.props.teams.length)
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
  handleUnreadCountChange: function(index, unreadCount, mentionCount) {
    var unreadCounts = this.state.unreadCounts;
    var mentionCounts = this.state.mentionCounts;
    unreadCounts[index] = unreadCount;
    mentionCounts[index] = mentionCount;
    this.setState({
      unreadCounts: unreadCounts,
      mentionCounts: mentionCounts
    });
    this.handleUnreadCountTotalChange();
  },
  handleUnreadAtActiveChange: function(index, isUnread, isMentioned) {
    var unreadAtActive = this.state.unreadAtActive;
    var mentionAtActive = this.state.mentionAtActive;
    unreadAtActive[index] = isUnread;
    mentionAtActive[index] = isMentioned;
    this.setState({
      unreadAtActive: unreadAtActive,
      mentionAtActive: mentionAtActive
    });
    this.handleUnreadCountTotalChange();
  },
  handleUnreadCountTotalChange: function() {
    if (this.props.onUnreadCountChange) {
      var allUnreadCount = this.state.unreadCounts.reduce(function(prev, curr) {
        return prev + curr;
      }, 0);
      this.state.unreadAtActive.forEach(function(state) {
        if (state) {
          allUnreadCount += 1;
        }
      });
      var allMentionCount = this.state.mentionCounts.reduce(function(prev, curr) {
        return prev + curr;
      }, 0);
      this.state.mentionAtActive.forEach(function(state) {
        if (state) {
          allMentionCount += 1;
        }
      });
      this.props.onUnreadCountChange(allUnreadCount, allMentionCount);
    }
  },
  handleNotify: function(index, isMentioned) {
    // Never turn on the unreadAtActive flag at current focused tab.
    if (this.state.key === index && remote.getCurrentWindow().isFocused()) {
      return;
    }
    this.handleUnreadAtActiveChange(index, true, isMentioned);
  },
  handleOnTeamFocused: function(index) {
    // Turn off the flag to indicate whether unread message of active channel contains at current tab.
    this.handleUnreadAtActiveChange(index, false, false);
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
          <TabBar id="tabBar" teams={ this.props.teams } unreadCounts={ this.state.unreadCounts } mentionCounts={ this.state.mentionCounts } unreadAtActive={ this.state.unreadAtActive } activeKey={ this.state.key }
          onSelect={ this.handleSelect }></TabBar>
        </Row>
      );
    }

    var views = this.props.teams.map(function(team, index) {
      var handleUnreadCountChange = function(unreadCount, mentionCount) {
        thisObj.handleUnreadCountChange(index, unreadCount, mentionCount);
      };
      var handleNotify = function(isMentioned) {
        thisObj.handleNotify(index, isMentioned);
      };
      var handleNotificationClick = function() {
        thisObj.handleSelect(index);
      }
      return (<MattermostView id={ 'mattermostView' + index } style={ thisObj.visibleStyle(thisObj.state.key === index) } src={ team.url } onUnreadCountChange={ handleUnreadCountChange } onNotify={ handleNotify }
              onNotificationClick={ handleNotificationClick } />)
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
      if (thisObj.props.mentionCounts[index] != 0) {
        badge = (<Badge>
                   { thisObj.props.mentionCounts[index] }
                 </Badge>);
      } else if (unreadCount > 0) {
        badge = (<Badge>
                   •
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
  getInitialState: function() {
    return {
      unreadCount: 0,
      mentionCount: 0
    };
  },
  handleUnreadCountChange: function(unreadCount, mentionCount) {
    this.setState({
      unreadCount: unreadCount,
      mentionCount: mentionCount
    });
    if (this.props.onUnreadCountChange) {
      this.props.onUnreadCountChange(unreadCount, mentionCount);
    }
  },

  handleNotify: function(isMentioned) {
    if (this.props.onNotify) {
      this.props.onNotify(isMentioned);
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
          var mentionCount = event.args[1];
          thisObj.handleUnreadCountChange(unreadCount, mentionCount);
          break;
        case 'onNotificationClick':
          thisObj.props.onNotificationClick();
          break;
        case 'console':
          console.log(event.args[0]);
          break;
        case 'onActiveChannelNotify':
          var isMentioned = event.args[0];
          thisObj.handleNotify(isMentioned);
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

var showUnreadBadge = function(unreadCount, mentionCount) {
  switch (process.platform) {
    case 'win32':
      var window = remote.getCurrentWindow();
      if (unreadCount > 0 || mentionCount > 0) {
        window.setOverlayIcon(path.join(__dirname, '../resources/badge.png'), 'You have unread channels.');
      } else {
        window.setOverlayIcon(null, '');
      }
      break;
    case 'darwin':
      if (mentionCount > 0) {
        remote.app.dock.setBadge(mentionCount.toString());
      } else if (mentionCount < unreadCount) {
        remote.app.dock.setBadge('•');
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
