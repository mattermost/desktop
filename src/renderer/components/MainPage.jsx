// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

// This files uses setState().
/* eslint-disable react/no-set-state */

import os from 'os';

import React, {Fragment} from 'react';
import PropTypes from 'prop-types';
import {Grid, Row} from 'react-bootstrap';
import DotsVerticalIcon from 'mdi-react/DotsVerticalIcon';

import {ipcRenderer, remote} from 'electron';

import urlUtils from 'common/utils/url';
import {
  FOCUS_BROWSERVIEW,
  ZOOM,
  UNDO,
  REDO,
  MAXIMIZE_CHANGE,
  DARK_MODE_CHANGE,
  HISTORY,
  LOAD_RETRY,
  LOAD_SUCCESS,
  LOAD_FAILED,
  SHOW_NEW_SERVER_MODAL,
  SWITCH_SERVER,
  WINDOW_CLOSE,
  WINDOW_MINIMIZE,
  WINDOW_RESTORE,
  WINDOW_MAXIMIZE,
  DOUBLE_CLICK_ON_WINDOW,
  PLAY_SOUND,
} from 'common/communication';

import restoreButton from '../../assets/titlebar/chrome-restore.svg';
import maximizeButton from '../../assets/titlebar/chrome-maximize.svg';
import minimizeButton from '../../assets/titlebar/chrome-minimize.svg';
import closeButton from '../../assets/titlebar/chrome-close.svg';
import spinner from '../../assets/loading.gif';
import spinnerx2 from '../../assets/loading@2x.gif';

import {playSound} from '../notificationSounds';

import LoginModal from './LoginModal.jsx';
import TabBar from './TabBar.jsx';
import Finder from './Finder.jsx';
import NewTeamModal from './NewTeamModal.jsx';
import SelectCertificateModal from './SelectCertificateModal.jsx';
import PermissionModal from './PermissionModal.jsx';
import ExtraBar from './ExtraBar.jsx';
import ErrorView from './ErrorView.jsx';

const LOADING = 1;
const DONE = 2;
const RETRY = -1;
const FAILED = 0;
const NOSERVERS = -2;

export default class MainPage extends React.Component {
  constructor(props) {
    super(props);

    let key = this.props.teams.findIndex((team) => team.order === this.props.initialIndex);
    if (this.props.deeplinkingUrl !== null) {
      const parsedDeeplink = this.parseDeeplinkURL(this.props.deeplinkingUrl);
      if (parsedDeeplink) {
        key = parsedDeeplink.teamIndex;
      }
    }

    this.topBar = React.createRef();
    this.threeDotMenu = React.createRef();

    this.state = {
      key,
      sessionsExpired: new Array(this.props.teams.length),
      unreadCounts: new Array(this.props.teams.length),
      mentionCounts: new Array(this.props.teams.length),
      unreadAtActive: new Array(this.props.teams.length),
      mentionAtActiveCounts: new Array(this.props.teams.length),
      loginQueue: [],
      targetURL: '',
      certificateRequests: [],
      maximized: false,
      showNewTeamModal: false,
      focusFinder: false,
      finderVisible: false,
      tabStatus: new Map(this.props.teams.map((server) => [server.name, {status: LOADING, extra: null}])),
      darkMode: this.props.darkMode,
    };
  }

  parseDeeplinkURL(deeplink, teams = this.props.teams) {
    if (deeplink && Array.isArray(teams) && teams.length) {
      const deeplinkURL = urlUtils.parseURL(deeplink);
      let parsedDeeplink = null;
      teams.forEach((team, index) => {
        const teamURL = urlUtils.parseURL(team.url);
        if (deeplinkURL.host === teamURL.host) {
          parsedDeeplink = {
            teamURL,
            teamIndex: index,
            originalURL: deeplinkURL,
            url: `${teamURL.origin}${deeplinkURL.pathname || '/'}`,
            path: deeplinkURL.pathname || '/',
          };
        }
      });
      return parsedDeeplink;
    }
    return null;
  }

  getTabStatus() {
    if (this.props.teams.length) {
      const tab = this.props.teams[this.state.key];
      if (tab) {
        const tabname = tab.name;
        return this.state.tabStatus.get(tabname);
      }
    }
    return {status: NOSERVERS};
  }

  componentDidMount() {
    // Due to a bug in Chrome on macOS, mousemove events from the webview won't register when the webview isn't in focus,
    // thus you can't drag tabs unless you're right on the container.
    // this makes it so your tab won't get stuck to your cursor no matter where you mouse up
    if (process.platform === 'darwin') {
      this.topBar.current.addEventListener('mouseleave', (event) => {
        if (event.target === this.topBar.current) {
          const upEvent = document.createEvent('MouseEvents');
          upEvent.initMouseEvent('mouseup');
          document.dispatchEvent(upEvent);
        }
      });

      // Hack for when it leaves the electron window because apparently mouseleave isn't good enough there...
      this.topBar.current.addEventListener('mousemove', (event) => {
        if (event.clientY === 0 || event.clientX === 0 || event.clientX >= window.innerWidth) {
          const upEvent = document.createEvent('MouseEvents');
          upEvent.initMouseEvent('mouseup');
          document.dispatchEvent(upEvent);
        }
      });
    }

    // set page on retry
    ipcRenderer.on(LOAD_RETRY, (_, server, retry, err, loadUrl) => {
      console.log(`${server}: failed to load ${err}, but retrying`);
      const status = this.state.tabStatus;
      const statusValue = {
        status: RETRY,
        extra: {
          retry,
          error: err,
          url: loadUrl,
        },
      };
      status.set(server, statusValue);
      this.setState({tabStatus: status});
    });

    ipcRenderer.on(LOAD_SUCCESS, (_, server) => {
      const status = this.state.tabStatus;
      status.set(server, {status: DONE});
      this.setState({tabStatus: status});
    });

    ipcRenderer.on(LOAD_FAILED, (_, server, err, loadUrl) => {
      console.log(`${server}: failed to load ${err}`);
      const status = this.state.tabStatus;
      const statusValue = {
        status: FAILED,
        extra: {
          error: err,
          url: loadUrl,
        },
      };
      status.set(server, statusValue);
      this.setState({tabStatus: status});
    });

    ipcRenderer.on('login-request', (event, request, authInfo) => {
      this.loginRequest(event, request, authInfo);
    });

    ipcRenderer.on('select-user-certificate', (_, origin, certificateList) => {
      const certificateRequests = this.state.certificateRequests;
      certificateRequests.push({
        server: origin,
        certificateList,
      });
      this.setState({
        certificateRequests,
      });
      if (certificateRequests.length === 1) {
        this.switchToTabForCertificateRequest(origin);
      }
    });

    ipcRenderer.on(DARK_MODE_CHANGE, (_, darkMode) => {
      this.setState({darkMode});
    });

    // can't switch tabs sequentially for some reason...
    ipcRenderer.on(SWITCH_SERVER, (event, key) => {
      const nextIndex = this.props.teams.findIndex((team) => team.order === key);
      const team = this.props.teams[nextIndex];
      this.handleSelect(team.name, nextIndex);
    });
    ipcRenderer.on('select-next-tab', () => {
      const currentOrder = this.props.teams[this.state.key].order;
      const nextOrder = ((currentOrder + 1) % this.props.teams.length);
      const nextIndex = this.props.teams.findIndex((team) => team.order === nextOrder);
      const team = this.props.teams[nextIndex];
      this.handleSelect(team.name, nextIndex);
    });

    ipcRenderer.on('select-previous-tab', () => {
      const currentOrder = this.props.teams[this.state.key].order;

      // js modulo operator returns a negative number if result is negative, so we have to ensure it's positive
      const nextOrder = ((this.props.teams.length + (currentOrder - 1)) % this.props.teams.length);
      const nextIndex = this.props.teams.findIndex((team) => team.order === nextOrder);
      const team = this.props.teams[nextIndex];
      this.handleSelect(team.name, nextIndex);
    });

    // reload the activated tab
    ipcRenderer.on('reload-tab', () => {
      this.refs[`mattermostView${this.state.key}`].reload();
    });
    ipcRenderer.on('clear-cache-and-reload-tab', () => {
      this.refs[`mattermostView${this.state.key}`].clearCacheAndReload();
    });

    ipcRenderer.on('focus', this.focusListener);
    ipcRenderer.on('blur', this.blurListener);

    ipcRenderer.on(MAXIMIZE_CHANGE, this.handleMaximizeState);

    ipcRenderer.on('enter-full-screen', () => this.handleFullScreenState(true));
    ipcRenderer.on('leave-full-screen', () => this.handleFullScreenState(false));

    // TODO: check this doesn't happen
    // https://github.com/mattermost/desktop/pull/371#issuecomment-263072803

    ipcRenderer.on('open-devtool', () => {
      document.getElementById(`mattermostView${this.state.key}`).openDevTools();
    });

    ipcRenderer.on('zoom-in', () => {
      // TODO: do something with this
      ipcRenderer.send(ZOOM, 1);
    });

    ipcRenderer.on('zoom-out', () => {
      // TODO: do something with this
      ipcRenderer.send(ZOOM, -1);
    });

    ipcRenderer.on('zoom-reset', () => {
      // TODO: do something with this
      ipcRenderer.send(ZOOM, null);
    });

    ipcRenderer.on('undo', () => {
      // TODO: do something with this
      ipcRenderer.send(UNDO);
    });

    ipcRenderer.on('redo', () => {
      // TODO: do something with this
      ipcRenderer.send(REDO);
    });

    // TODO: should this be an ipcRenderer.invoke?
    // ipcRenderer.on('cut', () => {
    //   const activeTabWebContents = this.getTabWebContents(this.state.key);
    //   if (!activeTabWebContents) {
    //     return;
    //   }
    //   activeTabWebContents.cut();
    // });

    // ipcRenderer.on('copy', () => {
    //   const activeTabWebContents = this.getTabWebContents(this.state.key);
    //   if (!activeTabWebContents) {
    //     return;
    //   }
    //   activeTabWebContents.copy();
    // });

    // ipcRenderer.on('paste', () => {
    //   const activeTabWebContents = this.getTabWebContents(this.state.key);
    //   if (!activeTabWebContents) {
    //     return;
    //   }
    //   activeTabWebContents.paste();
    // });

    // ipcRenderer.on('paste-and-match', () => {
    //   const activeTabWebContents = this.getTabWebContents(this.state.key);
    //   if (!activeTabWebContents) {
    //     return;
    //   }
    //   activeTabWebContents.pasteAndMatchStyle();
    // });

    //goBack and goForward
    ipcRenderer.on('go-back', () => {
      // TODO: do something with this
      ipcRenderer.send(ZOOM, -1);
      const mattermost = this.refs[`mattermostView${this.state.key}`];
      if (mattermost.canGoBack()) {
        mattermost.goBack();
      }
    });

    ipcRenderer.on('go-forward', () => {
      const mattermost = this.refs[`mattermostView${this.state.key}`];
      if (mattermost.canGoForward()) {
        mattermost.goForward();
      }
    });

    ipcRenderer.on('add-server', () => {
      this.addServer();
    });

    ipcRenderer.on('focus-on-webview', () => {
      ipcRenderer.send(FOCUS_BROWSERVIEW);
    });

    ipcRenderer.on('protocol-deeplink', (event, deepLinkUrl) => {
      const parsedDeeplink = this.parseDeeplinkURL(deepLinkUrl);
      if (parsedDeeplink) {
        if (this.state.key !== parsedDeeplink.teamIndex) {
          this.handleSelect(parsedDeeplink.teamIndex);
        }
        this.refs[`mattermostView${parsedDeeplink.teamIndex}`].handleDeepLink(parsedDeeplink.path);
      }
    });

    ipcRenderer.on('toggle-find', () => {
      this.activateFinder(true);
    });

    ipcRenderer.on(PLAY_SOUND, (_event, soundName) => {
      playSound(soundName);
    });

    if (process.platform !== 'darwin') {
      ipcRenderer.on('focus-three-dot-menu', () => {
        if (this.threeDotMenu.current) {
          this.threeDotMenu.current.focus();
        }
      });
    }
  }

  focusListener = () => {
    if (this.state.showNewTeamModal && this.inputRef && this.inputRef.current) {
      this.inputRef.current.focus();
    } else if (!(this.state.finderVisible && this.state.focusFinder)) {
      this.handleOnTeamFocused(this.state.key);
    }
    this.setState({unfocused: false});
  }

  blurListener = () => {
    this.setState({unfocused: true});
  }
  loginRequest = (event, request, authInfo) => {
    const loginQueue = this.state.loginQueue;
    loginQueue.push({
      request,
      authInfo,
    });
    this.setState({
      loginRequired: true,
      loginQueue,
    });
  };

  // componentDidUpdate(prevProps, prevState) {
  //   if (prevState.key !== this.state.key) { // i.e. When tab has been changed
  //     this.refs[`mattermostView${this.state.key}`].focusOnWebView();
  //   }
  // }

  switchToTabForCertificateRequest = (origin) => {
    // origin is server name + port, if the port doesn't match the protocol, it is kept by URL
    const originURL = urlUtils.parseURL(`http://${origin.split(':')[0]}`);
    const secureOriginURL = urlUtils.parseURL(`https://${origin.split(':')[0]}`);

    const key = this.props.teams.findIndex((team) => {
      const parsedURL = urlUtils.parseURL(team.url);
      return (parsedURL.origin === originURL.origin) || (parsedURL.origin === secureOriginURL.origin);
    });
    this.handleSelect(key);
  };

  handleInterTeamLink = (linkUrl) => {
    const selectedTeam = urlUtils.getServer(linkUrl, this.props.teams);
    if (!selectedTeam) {
      return;
    }
    this.refs[`mattermostView${selectedTeam.index}`].handleDeepLink(linkUrl.href);
    this.setState({key: selectedTeam.index});
  }

  handleMaximizeState = (_, maximized) => {
    this.setState({maximized});
  }

  handleFullScreenState = (isFullScreen) => {
    this.setState({fullScreen: isFullScreen});
  }

  handleSelect = (name, key) => {
    ipcRenderer.send('switch-server', name);
    const newKey = (this.props.teams.length + key) % this.props.teams.length;
    this.setState({
      key: newKey,
      finderVisible: false,
    });
    this.handleOnTeamFocused(newKey);
  }

  handleDragAndDrop = async (dropResult) => {
    const {removedIndex, addedIndex} = dropResult;
    if (removedIndex !== addedIndex) {
      const teamIndex = await this.props.moveTabs(removedIndex, addedIndex < this.props.teams.length ? addedIndex : this.props.teams.length - 1);
      const name = this.props.teams[teamIndex].name;
      this.handleSelect(name, teamIndex);
    }
  }

  // TODO: this is the last function using remote in this file, we should rework handling the badge change to completely remove it.
  handleBadgeChange = (index, sessionExpired, unreadCount, mentionCount, isUnread, isMentioned) => {
    const sessionsExpired = this.state.sessionsExpired;
    const unreadCounts = this.state.unreadCounts;
    const mentionCounts = this.state.mentionCounts;
    const unreadAtActive = this.state.unreadAtActive;
    const mentionAtActiveCounts = this.state.mentionAtActiveCounts;
    sessionsExpired[index] = sessionExpired;
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
      sessionsExpired,
      unreadCounts,
      mentionCounts,
      unreadAtActive,
      mentionAtActiveCounts,
    });
    this.handleBadgesChange();
  }

  markReadAtActive = (index) => {
    const unreadAtActive = this.state.unreadAtActive;
    const mentionAtActiveCounts = this.state.mentionAtActiveCounts;
    unreadAtActive[index] = false;
    mentionAtActiveCounts[index] = 0;
    this.setState({
      unreadAtActive,
      mentionAtActiveCounts,
    });
    this.handleBadgesChange();
  }

  handleBadgesChange = () => {
    if (this.props.onBadgeChange) {
      const someSessionsExpired = this.state.sessionsExpired.some((sessionExpired) => sessionExpired);

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

      this.props.onBadgeChange(someSessionsExpired, allUnreadCount, allMentionCount);
    }
  }

  handleOnTeamFocused = (index) => {
    // Turn off the flag to indicate whether unread message of active channel contains at current tab.
    // TODO: this should be handled by the viewmanager and the browserview
    this.markReadAtActive(index);
    return index;
  }

  handleTargetURLChange = (targetURL) => {
    clearTimeout(this.targetURLDisappearTimeout);
    if (targetURL === '') {
      // set delay to avoid momentary disappearance when hovering over multiple links
      this.targetURLDisappearTimeout = setTimeout(() => {
        this.setState({targetURL: ''});
      }, 500);
    } else {
      this.setState({targetURL});
    }
  }

  handleClose = (e) => {
    e.stopPropagation(); // since it is our button, the event goes into MainPage's onclick event, getting focus back.
    ipcRenderer.send(WINDOW_CLOSE);
  }

  handleMinimize = (e) => {
    e.stopPropagation();
    ipcRenderer.send(WINDOW_MINIMIZE);
  }

  handleMaximize = (e) => {
    e.stopPropagation();
    ipcRenderer.send(WINDOW_MAXIMIZE);
  }

  handleRestore = () => {
    ipcRenderer.send(WINDOW_RESTORE);
  }

  openMenu = () => {
    if (process.platform !== 'darwin') {
      this.threeDotMenu.current.blur();
    }
    this.props.openMenu();
  }

  handleDoubleClick = () => {
    ipcRenderer.send(DOUBLE_CLICK_ON_WINDOW);
  }

  addServer = () => {
    // this.setState({
    //   showNewTeamModal: true,
    // });
    // TODO: remove
    console.log('requesting new server modal');
    ipcRenderer.send(SHOW_NEW_SERVER_MODAL);
  }

  focusOnWebView = () => {
    ipcRenderer.send(FOCUS_BROWSERVIEW);
  }

  activateFinder = () => {
    this.setState({
      finderVisible: true,
      focusFinder: true,
    });
  }

  closeFinder = () => {
    this.setState({
      finderVisible: false,
      focusFinder: false,
    });
  }

  inputFocus = (e, focus) => {
    this.setState({
      focusFinder: focus,
    });
  }

  handleSelectCertificate = (certificate) => {
    const certificateRequests = this.state.certificateRequests;
    const current = certificateRequests.shift();
    this.setState({certificateRequests});
    ipcRenderer.send('selected-client-certificate', current.server, certificate);
    if (certificateRequests.length > 0) {
      this.switchToTabForCertificateRequest(certificateRequests[0].server);
    }
  }
  handleCancelCertificate = () => {
    const certificateRequests = this.state.certificateRequests;
    const current = certificateRequests.shift();
    this.setState({certificateRequests});
    ipcRenderer.send('selected-client-certificate', current.server);
    if (certificateRequests.length > 0) {
      this.switchToTabForCertificateRequest(certificateRequests[0].server);
    }
  };

  setInputRef = (ref) => {
    this.inputRef = ref;
  }

  showExtraBar = () => {
    const ref = this.refs[`mattermostView${this.state.key}`];
    if (typeof ref !== 'undefined') {
      return !urlUtils.isTeamUrl(this.props.teams[this.state.key].url, ref.getSrc());
    }
    return false;
  }

  render() {
    const tabsRow = (
      <TabBar
        id='tabBar'
        isDarkMode={this.state.darkMode}
        teams={this.props.teams}
        sessionsExpired={this.state.sessionsExpired}
        unreadCounts={this.state.unreadCounts}
        mentionCounts={this.state.mentionCounts}
        unreadAtActive={this.state.unreadAtActive}
        mentionAtActiveCounts={this.state.mentionAtActiveCounts}
        activeKey={this.state.key}
        onSelect={this.handleSelect}
        onAddServer={this.addServer}
        showAddServerButton={this.props.showAddServerButton}
        onDrop={this.handleDragAndDrop}
      />
    );

    let topBarClassName = 'topBar';
    if (process.platform === 'darwin') {
      topBarClassName += ' macOS';
    }
    if (this.state.darkMode) {
      topBarClassName += ' darkMode';
    }
    if (this.state.fullScreen) {
      topBarClassName += ' fullScreen';
    }

    let maxButton;
    if (this.state.maximized) {
      maxButton = (
        <div
          className='button restore-button'
          onClick={this.handleRestore}
        >
          <img src={restoreButton}/>
        </div>
      );
    } else {
      maxButton = (
        <div
          className='button max-button'
          onClick={this.handleMaximize}
        >
          <img src={maximizeButton}/>
        </div>
      );
    }

    let overlayGradient;
    if (process.platform !== 'darwin') {
      overlayGradient = (
        <span className='overlay-gradient'/>
      );
    }

    let titleBarButtons;
    if (os.platform() === 'win32' && os.release().startsWith('10')) {
      titleBarButtons = (
        <span className='title-bar-btns'>
          <div
            className='button min-button'
            onClick={this.handleMinimize}
          >
            <img src={minimizeButton}/>
          </div>
          {maxButton}
          <div
            className='button close-button'
            onClick={this.handleClose}
          >
            <img src={closeButton}/>
          </div>
        </span>
      );
    }

    const topRow = (
      <Row
        className={topBarClassName}
        onDoubleClick={this.handleDoubleClick}
      >
        <div
          ref={this.topBar}
          className={`topBar-bg${this.state.unfocused ? ' unfocused' : ''}`}
        >
          <button
            className='three-dot-menu'
            onClick={this.openMenu}
            tabIndex={0}
            ref={this.threeDotMenu}
            aria-label='Context menu'
          >
            <DotsVerticalIcon/>
          </button>
          {tabsRow}
          {overlayGradient}
          {titleBarButtons}
        </div>
      </Row>
    );

    const views = () => {
      // function handleBadgeChange(sessionExpired, unreadCount, mentionCount, isUnread, isMentioned) {
      //   this.handleBadgeChange(index, sessionExpired, unreadCount, mentionCount, isUnread, isMentioned);
      // }
      // function handleNotificationClick() {
      //   this.handleSelect(index);
      // }
      // let teamUrl = team.url;

      // if (this.props.deeplinkingUrl) {
      //   const parsedDeeplink = this.parseDeeplinkURL(this.props.deeplinkingUrl, [team]);
      //   if (parsedDeeplink) {
      //     teamUrl = parsedDeeplink.url;
      //   }
      // }

      let component;
      const tabStatus = this.getTabStatus();
      if (!tabStatus) {
        const tab = this.props.teams[this.state.key];
        if (tab) {
          console.error(`Not tabStatus for ${this.props.teams[this.state.key].name}`);
        } else {
          console.error('No tab status, tab doesn\'t exist anymore');
        }
        return null;
      }
      switch (tabStatus.status) {
      case NOSERVERS: // TODO: substitute with https://mattermost.atlassian.net/browse/MM-25003
        component = (
          <ErrorView
            id={'NoServers'}
            className='errorView'
            errorInfo={'No Servers configured'}
            url={tabStatus.extra ? tabStatus.extra.url : ''}
            active={true}
            retry={null}
            appName={this.props.appName}
          />);
        break;
      case RETRY:
      case FAILED:
        component = (
          <ErrorView
            id={this.state.key + '-fail'}
            className='errorView'
            errorInfo={tabStatus.extra ? tabStatus.extra.error : null}
            url={tabStatus.extra ? tabStatus.extra.url : ''}
            active={true}
            retry={tabStatus.extra ? tabStatus.extra.retry : null} // TODO: fix countdown so it counts
            appName={this.props.appName}
          />);
        break;
      case LOADING:
        component = (
          <div className='mattermostView-loadingScreen'>
            <img
              className='mattermostView-loadingImage'
              src={spinner}
              srcSet={`${spinner} 1x, ${spinnerx2} 2x`}
            />
          </div>);
        break;
      case DONE:
        component = null;
      }
      return component;
    };

    const viewsRow = (
      <Fragment>
        <ExtraBar
          darkMode={this.state.darkMode}
          show={this.showExtraBar()}
          goBack={() => {
            ipcRenderer.send(HISTORY, -1);
          }}
        />
        <Row>
          {views()}
        </Row>
      </Fragment>);

    let request = null;
    let authServerURL = null;
    let authInfo = null;
    if (this.state.loginQueue.length !== 0) {
      request = this.state.loginQueue[0].request;
      const tmpURL = urlUtils.parseURL(this.state.loginQueue[0].request.url);
      authServerURL = `${tmpURL.protocol}//${tmpURL.host}`;
      authInfo = this.state.loginQueue[0].authInfo;
    }
    const modal = (
      <NewTeamModal
        currentOrder={this.props.teams.length}
        show={this.state.showNewTeamModal}
        setInputRef={this.setInputRef}
        onClose={() => {
          this.setState({
            showNewTeamModal: false,
          });
        }}
        onSave={(newTeam) => {
          this.props.localTeams.push(newTeam);
          this.props.onTeamConfigChange(this.props.localTeams, () => {
            this.setState({
              showNewTeamModal: false,
              key: this.props.teams.length - 1,
            });
          });
        }}
      />
    );
    return (
      <div
        className='MainPage'
        onClick={this.focusOnWebView}
      >
        <LoginModal
          show={this.state.loginQueue.length !== 0}
          request={request}
          authInfo={authInfo}
          authServerURL={authServerURL}
          onLogin={this.handleLogin}
          onCancel={this.handleLoginCancel}
        />
        <PermissionModal/>
        <SelectCertificateModal
          certificateRequests={this.state.certificateRequests}
          onSelect={this.handleSelectCertificate}
          onCancel={this.handleCancelCertificate}
        />
        <Grid fluid={true}>
          { topRow }
          { viewsRow }
          { this.state.finderVisible ? (
            <Finder
              webviewKey={this.state.key}
              close={this.closeFinder}
              focusState={this.state.focusFinder}
              inputFocus={this.inputFocus}
            />
          ) : null}
        </Grid>
        <div>
          { modal }
        </div>
      </div>
    );
  }
}

MainPage.propTypes = {
  onBadgeChange: PropTypes.func.isRequired,
  teams: PropTypes.array.isRequired,
  localTeams: PropTypes.array.isRequired,
  onTeamConfigChange: PropTypes.func.isRequired,
  initialIndex: PropTypes.number.isRequired,
  useSpellChecker: PropTypes.bool.isRequired,
  deeplinkingUrl: PropTypes.string,
  showAddServerButton: PropTypes.bool.isRequired,
  moveTabs: PropTypes.func.isRequired,
  openMenu: PropTypes.func.isRequired,
  darkMode: PropTypes.bool.isRequired,
  appName: PropTypes.string.isRequired
};

/* eslint-enable react/no-set-state */
