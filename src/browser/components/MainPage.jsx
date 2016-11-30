const React = require('react');
const {Grid, Row} = require('react-bootstrap');

const {ipcRenderer, remote} = require('electron');
const url = require('url');

const LoginModal = require('./LoginModal.jsx');
const MattermostView = require('./MattermostView.jsx');
const TabBar = require('./TabBar.jsx');

const MainPage = React.createClass({
  propTypes: {
    disablewebsecurity: React.PropTypes.bool.isRequired,
    onUnreadCountChange: React.PropTypes.func.isRequired,
    teams: React.PropTypes.array.isRequired
  },

  getInitialState() {
    return {
      key: 0,
      unreadCounts: new Array(this.props.teams.length),
      mentionCounts: new Array(this.props.teams.length),
      unreadAtActive: new Array(this.props.teams.length),
      mentionAtActiveCounts: new Array(this.props.teams.length),
      loginQueue: []
    };
  },
  componentDidMount() {
    var self = this;
    ipcRenderer.on('login-request', (event, request, authInfo) => {
      self.setState({
        loginRequired: true
      });
      const loginQueue = self.state.loginQueue;
      loginQueue.push({
        request,
        authInfo
      });
      self.setState({
        loginQueue
      });
    });

    // can't switch tabs sequencially for some reason...
    ipcRenderer.on('switch-tab', (event, key) => {
      this.handleSelect(key);
    });
    ipcRenderer.on('select-next-tab', () => {
      this.handleSelect(this.state.key + 1);
    });
    ipcRenderer.on('select-previous-tab', () => {
      this.handleSelect(this.state.key - 1);
    });

    // reload the activated tab
    ipcRenderer.on('reload-tab', () => {
      this.refs[`mattermostView${this.state.key}`].reload();
    });
    ipcRenderer.on('clear-cache-and-reload-tab', () => {
      this.refs[`mattermostView${this.state.key}`].clearCacheAndReload();
    });

    // activate search box in current tab
    ipcRenderer.on('activate-search-box', () => {
      const webview = document.getElementById('mattermostView' + self.state.key);
      webview.send('activate-search-box');
    });

    // activate search box in current chunnel
    ipcRenderer.on('activate-search-box-in-channel', () => {
      const webview = document.getElementById('mattermostView' + self.state.key);
      webview.send('activate-search-box-in-channel');
    });

    function focusListener() {
      self.handleOnTeamFocused(self.state.key);
      self.refs[`mattermostView${self.state.key}`].focusOnWebView();
    }

    var currentWindow = remote.getCurrentWindow();
    currentWindow.on('focus', focusListener);
    window.addEventListener('beforeunload', () => {
      currentWindow.removeListener('focus', focusListener);
    });

    // https://github.com/mattermost/desktop/pull/371#issuecomment-263072803
    currentWindow.webContents.on('devtools-closed', () => {
      focusListener();
    });

    //goBack and goForward
    ipcRenderer.on('go-back', () => {
      const mattermost = self.refs[`mattermostView${self.state.key}`];
      if (mattermost.canGoBack()) {
        mattermost.goBack();
      }
    });

    ipcRenderer.on('go-forward', () => {
      const mattermost = self.refs[`mattermostView${self.state.key}`];
      if (mattermost.canGoForward()) {
        mattermost.goForward();
      }
    });
  },
  componentDidUpdate(prevProps, prevState) {
    if (prevState.key !== this.state.key) { // i.e. When tab has been changed
      this.refs[`mattermostView${this.state.key}`].focusOnWebView();
    }
  },
  handleSelect(key) {
    const newKey = (this.props.teams.length + key) % this.props.teams.length;
    this.setState({
      key: newKey
    });
    this.handleOnTeamFocused(newKey);

    var webview = document.getElementById('mattermostView' + newKey);
    ipcRenderer.send('update-title', {
      title: webview.getTitle()
    });
  },
  handleUnreadCountChange(index, unreadCount, mentionCount, isUnread, isMentioned) {
    var unreadCounts = this.state.unreadCounts;
    var mentionCounts = this.state.mentionCounts;
    var unreadAtActive = this.state.unreadAtActive;
    var mentionAtActiveCounts = this.state.mentionAtActiveCounts;
    unreadCounts[index] = unreadCount;
    mentionCounts[index] = mentionCount;

    // Never turn on the unreadAtActive flag at current focused tab.
    if (this.state.key !== index || !remote.getCurrentWindow().isFocused()) {
      unreadAtActive[index] = unreadAtActive[index] || isUnread;
      if (isMentioned) {
        mentionAtActiveCounts[index]++;
      }
    }
    this.setState({
      unreadCounts,
      mentionCounts,
      unreadAtActive,
      mentionAtActiveCounts
    });
    this.handleUnreadCountTotalChange();
  },
  markReadAtActive(index) {
    var unreadAtActive = this.state.unreadAtActive;
    var mentionAtActiveCounts = this.state.mentionAtActiveCounts;
    unreadAtActive[index] = false;
    mentionAtActiveCounts[index] = 0;
    this.setState({
      unreadAtActive,
      mentionAtActiveCounts
    });
    this.handleUnreadCountTotalChange();
  },
  handleUnreadCountTotalChange() {
    if (this.props.onUnreadCountChange) {
      var allUnreadCount = this.state.unreadCounts.reduce((prev, curr) => {
        return prev + curr;
      }, 0);
      this.state.unreadAtActive.forEach((state) => {
        if (state) {
          allUnreadCount += 1;
        }
      });
      var allMentionCount = this.state.mentionCounts.reduce((prev, curr) => {
        return prev + curr;
      }, 0);
      this.state.mentionAtActiveCounts.forEach((count) => {
        allMentionCount += count;
      });
      this.props.onUnreadCountChange(allUnreadCount, allMentionCount);
    }
  },
  handleOnTeamFocused(index) {
    // Turn off the flag to indicate whether unread message of active channel contains at current tab.
    this.markReadAtActive(index);
  },

  visibleStyle(visible) {
    var visibility = visible ? 'visible' : 'hidden';
    return {
      position: 'absolute',
      top: (this.props.teams.length > 1) ? 42 : 0,
      right: 0,
      bottom: 0,
      left: 0,
      visibility
    };
  },

  handleLogin(request, username, password) {
    ipcRenderer.send('login-credentials', request, username, password);
    const loginQueue = this.state.loginQueue;
    loginQueue.shift();
    this.setState({loginQueue});
  },
  handleLoginCancel() {
    const loginQueue = this.state.loginQueue;
    loginQueue.shift();
    this.setState({loginQueue});
  },
  render() {
    var self = this;

    var tabsRow;
    if (this.props.teams.length > 1) {
      tabsRow = (
        <Row>
          <TabBar
            id='tabBar'
            teams={this.props.teams}
            unreadCounts={this.state.unreadCounts}
            mentionCounts={this.state.mentionCounts}
            unreadAtActive={this.state.unreadAtActive}
            mentionAtActiveCounts={this.state.mentionAtActiveCounts}
            activeKey={this.state.key}
            onSelect={this.handleSelect}
          />
        </Row>
      );
    }

    var views = this.props.teams.map((team, index) => {
      function handleUnreadCountChange(unreadCount, mentionCount, isUnread, isMentioned) {
        self.handleUnreadCountChange(index, unreadCount, mentionCount, isUnread, isMentioned);
      }
      function handleNotificationClick() {
        self.handleSelect(index);
      }
      var id = 'mattermostView' + index;
      var isActive = self.state.key === index;
      return (
        <MattermostView
          key={id}
          id={id}
          style={self.visibleStyle(isActive)}
          src={team.url}
          name={team.name}
          disablewebsecurity={this.props.disablewebsecurity}
          onUnreadCountChange={handleUnreadCountChange}
          onNotificationClick={handleNotificationClick}
          ref={id}
          active={isActive}
        />);
    });
    var viewsRow = (
      <Row>
        {views}
      </Row>);

    var request = null;
    var authServerURL = null;
    var authInfo = null;
    if (this.state.loginQueue.length !== 0) {
      request = this.state.loginQueue[0].request;
      const tmpURL = url.parse(this.state.loginQueue[0].request.url);
      authServerURL = `${tmpURL.protocol}//${tmpURL.host}`;
      authInfo = this.state.loginQueue[0].authInfo;
    }
    return (
      <div>
        <LoginModal
          show={this.state.loginQueue.length !== 0}
          request={request}
          authInfo={authInfo}
          authServerURL={authServerURL}
          onLogin={this.handleLogin}
          onCancel={this.handleLoginCancel}
        />
        <Grid fluid={true}>
          { tabsRow }
          { viewsRow }
        </Grid>
      </div>
    );
  }
});

module.exports = MainPage;
