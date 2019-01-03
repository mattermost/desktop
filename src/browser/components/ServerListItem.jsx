// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react';
import PropTypes from 'prop-types';

export default class ServerListItem extends React.Component {
  constructor(props) {
    super(props);
    this.handleServerRemove = this.handleServerRemove.bind(this);
    this.handleServerEditing = this.handleServerEditing.bind(this);
  }

  handleServerRemove() {
    this.props.onServerRemove();
  }
  handleServerEditing() {
    this.props.onServerEditing();
  }
  render() {
    return (
      <div className='ServerListItem list-group-item'>
        <div
          className='ServerListItem-left'
          onClick={this.props.onServerClick}
        >
          <h4 className='list-group-item-heading'>{ this.props.name }</h4>
          <p className='list-group-item-text'>
            { this.props.url }
          </p>
        </div>
        <div className='pull-right'>
          <a
            href='#'
            onClick={this.handleServerEditing}
          >{'Edit'}</a>
          {' - '}
          <a
            href='#'
            onClick={this.handleServerRemove}
          >{'Remove'}</a>
        </div>
      </div>
    );
  }
}

ServerListItem.propTypes = {
  name: PropTypes.string,
  onServerEditing: PropTypes.func,
  onServerRemove: PropTypes.func,
  onServerClick: PropTypes.func,
  url: PropTypes.string,
};
