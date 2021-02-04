// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';

import {FIND_IN_PAGE, STOP_FIND_IN_PAGE, CLOSE_FINDER, FOUND_IN_PAGE} from 'common/communication.js';

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

class FinderRoot extends React.Component {
  constructor() {
    super();
    this.state = {};
  }

  componentDidMount() {
    window.addEventListener('message', async (event) => {
      switch (event.data.type) {
      case FOUND_IN_PAGE:
        this.setState({
          activeMatchOrdinal: event.data.data.activeMatchOrdinal,
          matches: event.data.data.matches,
        });
        break;
      default:
        break;
      }
    });
  }

  render() {
    return (
      <Finder
        activeMatchOrdinal={this.state.activeMatchOrdinal}
        matches={this.state.matches}
        close={closeFinder}
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
