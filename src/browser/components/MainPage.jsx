const React = require('react');
const PropTypes = require('prop-types');
const createReactClass = require('create-react-class');
const ReactCSSTransitionGroup = require('react-transition-group/CSSTransitionGroup');
const {Grid, Row} = require('react-bootstrap');

const {ipcRenderer, remote} = require('electron');
const url = require('url');

const LoginModal = require('./LoginModal.jsx');
const MattermostView = require('./MattermostView.jsx');
const TabBar = require('./TabBar.jsx');
const HoveringURL = require('./HoveringURL.jsx');

const NewTeamModal = require('./NewTeamModal.jsx');

const MainPage = createReactClass({
  propTypes: {
    onUnreadCountChange: PropTypes.func.isRequired,
    teams: PropTypes.array.isRequired,
    onTeamConfigChange: PropTypes.func.isRequired,
    initialIndex: PropTypes.number.isRequired,
    useSpellChecker: PropTypes.bool.isRequired,
    onSelectSpellCheckerLocale: PropTypes.func.isRequired
  },

  getInitialState() {
    return {
      key: this.props.initialIndex,
      unreadCounts: new Array(this.props.teams.length),
      mentionCounts: new Array(this.props.teams.length),
      unreadAtActive: new Array(this.props.teams.length),
      mentionAtActiveCounts: new Array(this.props.teams.length),
      loginQueue: [],
      targetURL: ''
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

    ipcRenderer.on('add-server', () => {
      this.addServer();
    });

    ipcRenderer.on('focus-on-webview', () => {
      this.focusOnWebView();
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
      let allUnreadCount = this.state.unreadCounts.reduce((prev, curr) => {
        return prev + curr;
      }, 0);
      this.state.unreadAtActive.forEach((state) => {
        if (state) {
          allUnreadCount += 1;
        }
      });
      let allMentionCount = this.state.mentionCounts.reduce((prev, curr) => {
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
  handleTargetURLChange(targetURL) {
    clearTimeout(this.targetURLDisappearTimeout);
    if (targetURL === '') {
      // set delay to avoid momentary disappearance when hovering over multiple links
      this.targetURLDisappearTimeout = setTimeout(() => {
        this.setState({targetURL: ''});
      }, 500);
    } else {
      this.setState({targetURL});
    }
  },
  addServer() {
    this.setState({
      showNewTeamModal: true
    });
  },

  focusOnWebView() {
    this.refs[`mattermostView${this.state.key}`].focusOnWebView();
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
            onAddServer={this.addServer}
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
          withTab={this.props.teams.length > 1}
          useSpellChecker={this.props.useSpellChecker}
          onSelectSpellCheckerLocale={this.props.onSelectSpellCheckerLocale}
          src={team.url}
          name={team.name}
          onTargetURLChange={self.handleTargetURLChange}
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
    var modal = (
      <NewTeamModal
        show={this.state.showNewTeamModal}
        onClose={() => {
          this.setState({
            showNewTeamModal: false
          });
        }}
        onSave={(newTeam) => {
          this.props.teams.push(newTeam);
          this.setState({
            showNewTeamModal: false,
            key: this.props.teams.length - 1
          });
          this.render();
          this.props.onTeamConfigChange(this.props.teams);
        }}
      />
    );
    return (
      <div className='MainPage'>
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
        <ReactCSSTransitionGroup
          transitionName='hovering'
          transitionEnterTimeout={300}
          transitionLeaveTimeout={500}
        >
          { (this.state.targetURL === '') ?
            null :
            <HoveringURL
              key='hoveringURL'
              targetURL={this.state.targetURL}
            /> }
        </ReactCSSTransitionGroup>
        <div>
          { modal }
        </div>
      </div>
    );
  }
});

module.exports = MainPage;
