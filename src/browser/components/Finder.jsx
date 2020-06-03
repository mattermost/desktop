// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable react/no-set-state */

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

  componentDidUpdate(prevProps) {
    if (this.props.focusState && (this.props.focusState !== prevProps.focusState)) {
      this.searchInput.focus();
    }
  }

  findNext = () => {
    this.webview.findInPage(this.state.searchTxt, {
      forward: true,
      findNext: true,
    });
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
    this.webview.findInPage(this.state.searchTxt, {forward: false, findNext: true});
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

  inputFocus = (e) => {
    e.stopPropagation();
    this.props.inputFocus(e, true);
  }

  inputBlur = (e) => {
    this.props.inputFocus(e, false);
  }

  render() {
    return (
      <div id='finder'>
        <div className={`finder${process.platform === 'darwin' ? ' macOS' : ''}`}>
          <div className='finder-input-wrapper'>
            <input
              className='finder-input'
              placeholder=''
              value={this.state.searchTxt}
              onChange={this.searchTxt}
              onBlur={this.inputBlur}
              onClick={this.inputFocus}
              ref={(input) => {
                this.searchInput = input;
              }}
            />
            <span className={this.state.foundInPage ? 'finder-progress' : 'finder-progress finder-progress__disabled'}>{this.state.matches}</span>
          </div>
          <button
            className='finder-prev'
            onClick={this.findPrev}
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              width='24'
              height='24'
              viewBox='0 0 24 24'
              className='icon'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <polyline points='18 15 12 9 6 15'/>
            </svg>
          </button>
          <button
            className='finder-next'
            onClick={this.findNext}
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              width='24'
              height='24'
              viewBox='0 0 24 24'
              fill='none'
              className='icon arrow-up'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <polyline points='6 9 12 15 18 9'/>
            </svg>
          </button>
          <button
            className='finder-close'
            onClick={this.props.close}
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              width='24'
              height='24'
              viewBox='0 0 24 24'
              fill='none'
              className='icon'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <line
                x1='18'
                y1='6'
                x2='6'
                y2='18'
              />
              <line
                x1='6'
                y1='6'
                x2='18'
                y2='18'
              />
            </svg>
          </button>
        </div>
      </div>
    );
  }
}

Finder.propTypes = {
  close: PropTypes.func,
  webviewKey: PropTypes.number,
  focusState: PropTypes.bool,
  inputFocus: PropTypes.func,
};
