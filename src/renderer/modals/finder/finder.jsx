// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import React from 'react';
import PropTypes from 'prop-types';

export default class Finder extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            foundInPage: false,
            searchTxt: '',
        };
    }

    componentDidMount() {
        this.searchInput.focus();

        // synthetic events are not working all that reliably for touch bar with esc keys
        this.searchInput.addEventListener('keyup', this.handleKeyEvent);
    }

    componentWillUnmount() {
        this.props.stopFindInPage('clearSelection');
        this.searchInput.removeEventListener('keyup', this.handleKeyEvent);
    }

    static getDerivedStateFromProps(props, state) {
        if (state.searchTxt) {
            return {
                foundInPage: Boolean(props.matches),
                matches: `${props.activeMatchOrdinal}/${props.matches}`,
            };
        }

        return {matches: '0/0'};
    }

    findNext = () => {
        this.props.findInPage(this.state.searchTxt, {
            forward: true,
            findNext: true,
        });
    };

    find = (keyword) => {
        this.props.stopFindInPage('clearSelection');
        if (keyword) {
            this.props.findInPage(keyword);
        } else {
            this.setState({
                matches: '0/0',
            });
        }
    };

    findPrev = () => {
        this.props.findInPage(this.state.searchTxt, {forward: false, findNext: true});
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

    close = () => {
        this.props.stopFindInPage('clearSelection');
        this.props.close();
    }

    render() {
        return (
            <div
                id='finder'
                onClick={this.props.focus}
            >
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
                        disabled={!this.state.searchTxt}
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
                        disabled={!this.state.searchTxt}
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
                        onClick={this.close}
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
    findInPage: PropTypes.func,
    stopFindInPage: PropTypes.func,
    activeMatchOrdinal: PropTypes.number,
    matches: PropTypes.number,
    focus: PropTypes.func,
};
