// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

// This files uses setState().
/* eslint-disable react/no-set-state */

import os from 'os';
import url from 'url';

import React, {Fragment} from 'react';
import PropTypes from 'prop-types';
import {CSSTransition, TransitionGroup} from 'react-transition-group';
import {Grid, Row} from 'react-bootstrap';
import DotsVerticalIcon from 'mdi-react/DotsVerticalIcon';

import {ipcRenderer, remote, shell} from 'electron';

import Utils from 'common/utils/util';
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
} from 'common/communication';

import restoreButton from '../../assets/titlebar/chrome-restore.svg';
import maximizeButton from '../../assets/titlebar/chrome-maximize.svg';
import minimizeButton from '../../assets/titlebar/chrome-minimize.svg';
import closeButton from '../../assets/titlebar/chrome-close.svg';

import LoginModal from './LoginModal.jsx';
import TabBar from './TabBar.jsx';
import HoveringURL from './HoveringURL.jsx';
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
      const deeplinkURL = url.parse(deeplink);
      let parsedDeeplink = null;
      teams.forEach((team, index) => {
        const teamURL = url.parse(team.url);
        if (deeplinkURL.host === teamURL.host) {
          parsedDeeplink = {
            teamURL,
            teamIndex: index,
            originalURL: deeplinkURL,
            url: `${teamURL.protocol}//${teamURL.host}${deeplinkURL.pathname || '/'}`,
            path: deeplinkURL.pathname || '/',
          };
        }
      });
      return parsedDeeplink;
    }
    return null;
  }

  getTabStatus() {
    return this.state.tabStatus[this.state.key];
  }

  getTabWebContents(index = this.state.key || 0, teams = this.props.teams) {
    const allWebContents = remote.webContents.getAllWebContents();

    if (this.state.showNewTeamModal) {
      const indexURL = '/renderer/index.html';
      return allWebContents.find((webContents) => webContents.getURL().includes(indexURL));
    }

    if (!teams || !teams.length || index > teams.length) {
      return null;
    }
    const tabURL = teams[index].url;
    if (!tabURL) {
      return null;
    }
    const tab = allWebContents.find((webContents) => webContents.isFocused() && webContents.getURL().includes(this.refs[`mattermostView${index}`].getSrc()));
    return tab || remote.webContents.getFocusedWebContents();
  }

  componentDidMount() {
    // Due to a bug in Chrome on macOS, mousemove events from the webview won't register when the webview isn't in focus,
    // thus you can't drag tabs unless you're right on the container.
    // this makes it so your tab won't get stuck to your cursor no matter where you mouse up
    if (process.platform === 'darwin') {
      this.topBar.current.addEventListener('mouseleave', () => {
        if (event.target === this.topBar.current) {
          const upEvent = document.createEvent('MouseEvents');
          upEvent.initMouseEvent('mouseup');
          document.dispatchEvent(upEvent);
        }
      });

      // Hack for when it leaves the electron window because apparently mouseleave isn't good enough there...
      this.topBar.current.addEventListener('mousemove', () => {
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
      status.set(server, DONE);
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
      console.log(`switch to dark mode ${darkMode}`);
      this.setState({darkMode});
    });

    // can't switch tabs sequentially for some reason...
    ipcRenderer.on('switch-tab', (event, key) => {
      const nextIndex = this.props.teams.findIndex((team) => team.order === key);
      this.handleSelect(nextIndex);
    });
    ipcRenderer.on('select-next-tab', () => {
      const currentOrder = this.props.teams[this.state.key].order;
      const nextOrder = ((currentOrder + 1) % this.props.teams.length);
      const nextIndex = this.props.teams.findIndex((team) => team.order === nextOrder);
      this.handleSelect(nextIndex);
    });

    ipcRenderer.on('select-previous-tab', () => {
      const currentOrder = this.props.teams[this.state.key].order;

      // js modulo operator returns a negative number if result is negative, so we have to ensure it's positive
      const nextOrder = ((this.props.teams.length + (currentOrder - 1)) % this.props.teams.length);
      const nextIndex = this.props.teams.findIndex((team) => team.order === nextOrder);
      this.handleSelect(nextIndex);
    });

    // reload the activated tab
    ipcRenderer.on('reload-tab', () => {
      this.refs[`mattermostView${this.state.key}`].reload();
    });
    ipcRenderer.on('clear-cache-and-reload-tab', () => {
      this.refs[`mattermostView${this.state.key}`].clearCacheAndReload();
    });
    ipcRenderer.on('download-complete', this.showDownloadCompleteNotification);

    ipcRenderer.on('focus', this.focusListener);
    ipcRenderer.on('blur', this.blurListener);

    ipcRenderer.on(MAXIMIZE_CHANGE, this.handleMaximizeState);

    ipcRenderer.on('enter-full-screen', this.handleFullScreenState);
    ipcRenderer.on('leave-full-screen', this.handleFullScreenState);

    // TODO: check this doesn't happen
    // https://github.com/mattermost/desktop/pull/371#issuecomment-263072803

    ipcRenderer.on('open-devtool', () => {
      document.getElementById(`mattermostView${this.state.key}`).openDevTools();
    });

    ipcRenderer.on('zoom-in', () => {
      // TODO: do something with this
      ipcRenderer.send(ZOOM, 1);

      // const activeTabWebContents = this.getTabWebContents(this.state.key);
      // if (!activeTabWebContents) {
      //   return;
      // }
      // if (activeTabWebContents.zoomLevel >= 9) {
      //   return;
      // }
      // activeTabWebContents.zoomLevel += 1;
    });

    ipcRenderer.on('zoom-out', () => {
      // TODO: do something with this
      ipcRenderer.send(ZOOM, -1);
    });

    ipcRenderer.on('zoom-reset', () => {
      // TODO: do something with this
      ipcRenderer.send(ZOOM, null);

      // const activeTabWebContents = this.getTabWebContents(this.state.key);
      // if (!activeTabWebContents) {
      //   return;
      // }
      // activeTabWebContents.zoomLevel = 0;
    });

    ipcRenderer.on('undo', () => {
      // TODO: do something with this
      ipcRenderer.send(UNDO);

      // const activeTabWebContents = this.getTabWebContents(this.state.key);
      // if (!activeTabWebContents) {
      //   return;
      // }
      // activeTabWebContents.undo();
    });

    ipcRenderer.on('redo', () => {
      // TODO: do something with this
      ipcRenderer.send(REDO);

      // const activeTabWebContents = this.getTabWebContents(this.state.key);
      // if (!activeTabWebContents) {
      //   return;
      // }
      // activeTabWebContents.redo();
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

    if (process.platform === 'darwin') {
      this.threeDotMenu = React.createRef();
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

  // TODO: do we need to do something
  // componentDidUpdate(prevProps, prevState) {
  //   if (prevState.key !== this.state.key) { // i.e. When tab has been changed
  //     this.refs[`mattermostView${this.state.key}`].focusOnWebView();
  //   }
  // }

  switchToTabForCertificateRequest = (origin) => {
    // origin is server name + port, if the port doesn't match the protocol, it is kept by URL
    const originURL = new URL(`http://${origin.split(':')[0]}`);
    const secureOriginURL = new URL(`https://${origin.split(':')[0]}`);

    const key = this.props.teams.findIndex((team) => {
      const parsedURL = new URL(team.url);
      return (parsedURL.origin === originURL.origin) || (parsedURL.origin === secureOriginURL.origin);
    });
    this.handleSelect(key);
  };

  handleInterTeamLink = (linkUrl) => {
    const selectedTeam = Utils.getServer(linkUrl, this.props.teams);
    if (!selectedTeam) {
      return;
    }
    this.refs[`mattermostView${selectedTeam.index}`].handleDeepLink(linkUrl.href);
    this.setState({key: selectedTeam.index});
  }

  handleMaximizeState = (_, maximized) => {
    this.setState({maximized});
  }

  handleFullScreenState = () => {
    const win = remote.getCurrentWindow();
    this.setState({fullScreen: win.isFullScreen()});
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

  handleDragAndDrop = (dropResult) => {
    const {removedIndex, addedIndex} = dropResult;
    if (removedIndex !== addedIndex) {
      const teamIndex = this.props.moveTabs(removedIndex, addedIndex < this.props.teams.length ? addedIndex : this.props.teams.length - 1);
      this.handleSelect(teamIndex);
    }
  }

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

  handleLogin = (request, username, password) => {
    ipcRenderer.send('login-credentials', request, username, password);
    const loginQueue = this.state.loginQueue;
    loginQueue.shift();
    this.setState({loginQueue});
  }

  handleLoginCancel = (request) => {
    ipcRenderer.send('login-cancel', request);

    const loginQueue = this.state.loginQueue;
    loginQueue.shift();
    this.setState({loginQueue});
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
    const win = remote.getCurrentWindow();
    win.close();
  }

  handleMinimize = (e) => {
    e.stopPropagation();
    const win = remote.getCurrentWindow();
    win.minimize();
  }

  handleMaximize = (e) => {
    e.stopPropagation();
    const win = remote.getCurrentWindow();
    win.maximize();
  }

  handleRestore = () => {
    const win = remote.getCurrentWindow();
    win.restore();
  }

  openMenu = () => {
    // @eslint-ignore
    this.threeDotMenu.current.blur();
    this.props.openMenu();
  }

  handleDoubleClick = () => {
    if (process.platform === 'darwin') {
      const doubleClickAction = remote.systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string');
      const win = remote.getCurrentWindow();
      if (doubleClickAction === 'Minimize') {
        win.minimize();
      } else if (!win.isMaximized()) {
        win.maximize();
      } else if (win.isMaximized()) {
        win.unmaximize();
      }
    }
  }

  addServer = () => {
    this.setState({
      showNewTeamModal: true,
    });
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

  showDownloadCompleteNotification = async (event, item) => {
    const title = process.platform === 'win32' ? item.serverInfo.name : 'Download Complete';
    const notificationBody = process.platform === 'win32' ? `Download Complete \n ${item.fileName}` : item.fileName;

    await Utils.dispatchNotification(title, notificationBody, false, () => {
      shell.showItemInFolder(item.path.normalize());
    });
  }

  setInputRef = (ref) => {
    this.inputRef = ref;
  }

  showExtraBar = () => {
    const ref = this.refs[`mattermostView${this.state.key}`];
    if (typeof ref !== 'undefined') {
      return !Utils.isTeamUrl(this.props.teams[this.state.key].url, ref.getSrc());
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
      switch (tabStatus.status) {
      case LOADING:
        break;
      case RETRY:
        break;
      case FAILED:
        component = (
          <ErrorView
            id={this.status.key + '-fail'}
            className='errorView'
            errorInfo={tabStatus.extra ? tabStatus.extra.error : null}
            url={tabStatus.extra ? tabStatus.extra.url : ''}
            active={true}
            retry={tabStatus.extra ? tabStatus.extra.retry : null}
            appName={this.props.appName}
          />);
        break;
      case DONE:
        console.log(`Loading tab ${this.status.key}`);
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
          {views}
        </Row>
      </Fragment>);

    let request = null;
    let authServerURL = null;
    let authInfo = null;
    if (this.state.loginQueue.length !== 0) {
      request = this.state.loginQueue[0].request;
      const tmpURL = url.parse(this.state.loginQueue[0].request.url);
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
        <TransitionGroup>
          { (this.state.targetURL === '') ?
            null :
            <CSSTransition
              classNames='hovering'
              timeout={{enter: 300, exit: 500}}
            >
              <HoveringURL
                key='hoveringURL'
                targetURL={this.state.targetURL}
              />
            </CSSTransition>
          }
        </TransitionGroup>
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
