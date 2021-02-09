// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';

import {FIND_IN_PAGE, STOP_FIND_IN_PAGE, CLOSE_FINDER, FOUND_IN_PAGE, FOCUS_FINDER} from 'common/communication.js';

import Finder from './finder.jsx';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/modals.css';
import 'renderer/css/components/Finder.css';

const closeFinder = () => {
  window.postMessage({type: CLOSE_FINDER}, window.location.href);
};

const findInPage = (searchText, options) => {
  window.postMessage({type: FIND_IN_PAGE, data: {searchText, options}}, window.location.href);
};

const stopFindInPage = (action) => {
  window.postMessage({type: STOP_FIND_IN_PAGE, data: action}, window.location.href);
};

const focusFinder = () => {
  window.postMessage({type: FOCUS_FINDER}, window.location.href);
};
class FinderRoot extends React.Component {
  constructor() {
    super();
    this.state = {};
  }

  componentDidMount() {
    window.addEventListener('message', this.handleMessageEvent);
  }

  componentWillUnmount() {
    window.removeEventListener('message', this.handleMessageEvent);
  }

  handleMessageEvent = (event) => {
    if (event.data.type === FOUND_IN_PAGE) {
      this.setState({
        activeMatchOrdinal: event.data.data.activeMatchOrdinal,
        matches: event.data.data.matches,
      });
    }
  }

  render() {
    return (
      <Finder
        activeMatchOrdinal={this.state.activeMatchOrdinal}
        matches={this.state.matches}
        close={closeFinder}
        focus={focusFinder}
        findInPage={findInPage}
        stopFindInPage={stopFindInPage}
      />
    );
  }
}
const start = async () => {
  ReactDOM.render(
    <FinderRoot/>,
    document.getElementById('app')
  );
};

start();
