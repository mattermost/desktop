// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';

import {Team} from 'types/config';

import {CLOSE_TEAMS_DROPDOWN, REQUEST_TEAMS_DROPDOWN_INFO, SEND_DROPDOWN_MENU_SIZE, SHOW_NEW_SERVER_MODAL, SWITCH_SERVER, UPDATE_TEAMS_DROPDOWN} from 'common/communication';

import './css/dropdown.scss';
import './css/compass-icons.css';

type State = {
    teams?: Team[];
    orderedTeams?: Team[];
    activeTeam?: string;
    darkMode?: boolean;
    enableServerManagement?: boolean;
    unreads?: Map<string, boolean>;
    mentions?: Map<string, number>;
    expired?: Map<string, boolean>;
}

class TeamDropdown extends React.PureComponent<Record<string, never>, State> {
    constructor(props: Record<string, never>) {
        super(props);
        this.state = {};

        window.addEventListener('message', this.handleMessageEvent);
    }

    handleMessageEvent = (event: MessageEvent) => {
        if (event.data.type === UPDATE_TEAMS_DROPDOWN) {
            const {teams, activeTeam, darkMode, enableServerManagement, unreads, mentions, expired} = event.data.data;
            this.setState({
                teams,
                orderedTeams: teams.concat().sort((a: Team, b: Team) => a.order - b.order),
                activeTeam,
                darkMode,
                enableServerManagement,
                unreads,
                mentions,
                expired,
            });
        }
    }

    selectServer = (team: Team) => {
        return () => {
            window.postMessage({type: SWITCH_SERVER, data: team.name}, window.location.href);
            this.closeMenu();
        };
    }

    closeMenu = () => {
        (document.activeElement as HTMLElement).blur();
        window.postMessage({type: CLOSE_TEAMS_DROPDOWN}, window.location.href);
    }

    preventPropogation = (event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
    }

    addServer = () => {
        window.postMessage({type: SHOW_NEW_SERVER_MODAL}, window.location.href);
        this.closeMenu();
    }

    isActiveTeam = (team: Team) => {
        return team.name === this.state.activeTeam;
    }

    componentDidMount() {
        window.postMessage({type: REQUEST_TEAMS_DROPDOWN_INFO}, window.location.href);
        window.addEventListener('click', this.closeMenu);
    }

    componentDidUpdate() {
        window.postMessage({type: SEND_DROPDOWN_MENU_SIZE, data: {width: document.body.scrollWidth, height: document.body.scrollHeight}}, window.location.href);
    }

    componentWillUnmount() {
        window.removeEventListener('click', this.closeMenu);
    }

    render() {
        return (
            <div
                onClick={this.preventPropogation}
                className={classNames('TeamDropdown', {
                    darkMode: this.state.darkMode,
                })}
            >
                <div className='TeamDropdown__header'>
                    <span>{'Servers'}</span>
                </div>
                <hr className='TeamDropdown__divider'/>
                {this.state.orderedTeams?.map((team, index) => {
                    const sessionExpired = this.state.expired?.get(team.name);
                    const hasUnreads = this.state.unreads?.get(team.name);
                    const mentionCount = this.state.mentions?.get(team.name);

                    let badgeDiv: React.ReactNode;
                    if (sessionExpired) {
                        badgeDiv = (
                            <div className='TeamDropdown__badge-expired'>
                                <i className='icon-alert-circle-outline'/>
                            </div>
                        );
                    } else if (mentionCount && mentionCount > 0) {
                        badgeDiv = (
                            <div className='TeamDropdown__badge-count'>
                                <span>{mentionCount > 99 ? '99+' : mentionCount}</span>
                            </div>
                        );
                    } else if (hasUnreads) {
                        badgeDiv = (
                            <div className='TeamDropdown__badge-dot'/>
                        );
                    }

                    return (
                        <button
                            className={'TeamDropdown__button'}
                            onClick={this.selectServer(team)}
                            key={index}
                        >
                            {this.isActiveTeam(team) ? <i className='icon-check'/> : <i className='icon-server-variant'/>}
                            <span>{team.name}</span>
                            <div className='TeamDropdown__indicators'>
                                <button
                                    className='TeamDropdown__button-edit'
                                    disabled={true}
                                >
                                    <i className='icon-pencil-outline'/>
                                </button>
                                <button
                                    className='TeamDropdown__button-remove'
                                    disabled={true}
                                >
                                    <i className='icon-trash-can-outline'/>
                                </button>
                                {badgeDiv && <div className='TeamDropdown__badge'>
                                    {badgeDiv}
                                </div>}
                            </div>
                        </button>
                    );
                })}
                <hr className='TeamDropdown__divider'/>
                {this.state.enableServerManagement &&
                    <button
                        className='TeamDropdown__button'
                        onClick={this.addServer}
                    >
                        <i className='icon-plus'/>
                        <span>{'Add a server'}</span>
                    </button>
                }
            </div>
        );
    }
}

ReactDOM.render(
    <TeamDropdown/>,
    document.getElementById('app'),
);
