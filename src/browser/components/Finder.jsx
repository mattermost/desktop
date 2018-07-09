// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react';
import PropTypes from 'prop-types';

export default class Finder extends React.Component {
  constructor(props) {
    super(props);
    this.webview = document.getElementById('mattermostView' + this.props.webviewKey);
    this.state = {
      foundInPage: false,
      searchTxt: '',
    };
  }

  componentDidMount() {
    this.webview.addEventListener('found-in-page', this.foundInPage);
    this.searchInput.focus();

    // synthetic events are not working all that reliably for touch bar with esc keys
    this.searchInput.addEventListener('keyup', this.handleKeyEvent);
  }

  componentWillUnmount() {
    this.webview.stopFindInPage('clearSelection');
    this.webview.removeEventListener('found-in-page', this.foundInPage);
    this.searchInput.removeEventListener('keyup', this.handleKeyEvent);
  }

  findNext = () => {
    this.webview.findInPage(this.state.searchTxt);
  };

  find = (keyword) => {
    this.webview.stopFindInPage('clearSelection');
    if (keyword) {
      this.webview.findInPage(keyword);
    } else {
      this.setState({
        matches: '0/0',
      });
    }
  };

  findPrev = () => {
    this.webview.findInPage(this.state.searchTxt, {forward: false});
  }

  searchTxt = (event) => {
    this.setState({searchTxt: event.target.value});
    this.find(event.target.value);
  }

  handleKeyEvent = (event) => {
    if (event.code === 'Escape') {
      this.props.close();
    } else if (event.code === 'Enter') {
      this.findNext();
    }
  }

  foundInPage = (event) => {
    const {matches, activeMatchOrdinal} = event.result;
    this.setState({
      foundInPage: true,
      matches: `${activeMatchOrdinal}/${matches}`,
    });
  }

  render() {
    return (
      <div id='finder'>
        <div className='finder'>
          <div className='finder-input-wrapper'>
            <input
              className='finder-input'
              placeholder=''
              value={this.state.searchTxt}
              onChange={this.searchTxt}
              ref={(input) => {
                this.searchInput = input;
              }}
            />
            <span className={this.state.foundInPage ? 'finder-progress' : 'finder-progress finder-progress__disabled'}>{this.state.matches}</span>
          </div>
          <button
            className='finder-prev'
            onClick={this.findPrev}
          >{'↑'}</button>
          <button
            className='finder-next'
            onClick={this.findNext}
          >{'↓'}</button>
          <button
            className='finder-close'
            onClick={this.props.close}
          >{'✕'}</button>
        </div>
      </div>
    );
  }
}

Finder.propTypes = {
  close: PropTypes.func,
  webviewKey: PropTypes.number,
};
