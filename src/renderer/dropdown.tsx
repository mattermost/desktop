// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';

import {Team} from 'types/config';

import {REQUEST_TEAMS_DROPDOWN_INFO, SEND_DROPDOWN_MENU_SIZE, UPDATE_TEAMS_DROPDOWN} from 'common/communication';

import './css/dropdown.css';

type State = {
    teams?: Team[];
    unreads?: Map<string, boolean>;
    mentions?: Map<string, number>;
    expired?: Map<string, boolean>;
}

class TeamDropdown extends React.PureComponent<Record<string, never>, State> {
    wrapperRef: React.RefObject<HTMLDivElement>;

    constructor(props: Record<string, never>) {
        super(props);
        this.state = {};

        this.wrapperRef = React.createRef();

        window.addEventListener('message', this.handleMessageEvent);
    }

    handleMessageEvent = (event: MessageEvent) => {
        if (event.data.type === UPDATE_TEAMS_DROPDOWN) {
            const {teams, unreads, mentions, expired} = event.data.data;
            this.setState({
                teams,
                unreads,
                mentions,
                expired,
            });
        }
    }

    componentDidMount() {
        window.postMessage({type: REQUEST_TEAMS_DROPDOWN_INFO}, window.location.href);
    }

    componentDidUpdate() {
        window.postMessage({type: SEND_DROPDOWN_MENU_SIZE, data: {width: this.wrapperRef.current?.scrollWidth, height: this.wrapperRef.current?.scrollHeight}}, window.location.href);
    }

    render() {
        return (
            <div
                className='TeamDropdown'
                ref={this.wrapperRef}
            >
                {this.state.teams?.map((team, index) => (
                    <div key={index}>{`${team.name}-${this.state.unreads?.get(team.name)}-${this.state.mentions?.get(team.name)}-${this.state.expired?.get(team.name)}`}</div>
                ))}
            </div>
        );
    }
}

ReactDOM.render(
    <TeamDropdown/>,
    document.getElementById('app'),
);
