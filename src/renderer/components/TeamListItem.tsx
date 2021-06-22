// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import React from 'react';

type Props = {
    name: string;
    onTeamEditing: () => void;
    onTeamRemove: () => void;
    onTeamClick: React.MouseEventHandler<HTMLDivElement>;
    url: string;
};

export default class TeamListItem extends React.PureComponent<Props> {
    handleTeamRemove = () => {
        this.props.onTeamRemove();
    }
    handleTeamEditing = () => {
        this.props.onTeamEditing();
    }
    render() {
        return (
            <div className='TeamListItem list-group-item'>
                <div
                    className='TeamListItem-left'
                    onClick={this.props.onTeamClick}
                >
                    <h4 className='list-group-item-heading'>{ this.props.name }</h4>
                    <p className='list-group-item-text'>
                        { this.props.url }
                    </p>
                </div>
                <div className='pull-right'>
                    <a
                        href='#'
                        onClick={this.handleTeamEditing}
                    >{'Edit'}</a>
                    {' - '}
                    <a
                        href='#'
                        onClick={this.handleTeamRemove}
                    >{'Remove'}</a>
                </div>
            </div>
        );
    }
}
