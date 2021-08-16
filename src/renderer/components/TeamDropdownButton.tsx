// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import {CLOSE_TEAMS_DROPDOWN, OPEN_TEAMS_DROPDOWN} from 'common/communication';

import '../css/components/TeamDropdownButton.scss';
import '../css/compass-icons.css';

type Props = {
    isDisabled?: boolean;
    activeServerName: string;
    totalMentionCount: number;
    hasUnreads: boolean;
    isMenuOpen: boolean;
    darkMode: boolean;
}

const TeamDropdownButton: React.FC<Props> = (props: Props) => {
    const {isDisabled, activeServerName, totalMentionCount, hasUnreads, isMenuOpen, darkMode} = props;

    const handleToggleButton = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        window.ipcRenderer.send(isMenuOpen ? CLOSE_TEAMS_DROPDOWN : OPEN_TEAMS_DROPDOWN);
    };

    let badgeDiv: React.ReactNode;
    if (totalMentionCount > 0) {
        badgeDiv = (
            <div className='TeamDropdownButton__badge-count'>
                <span>{totalMentionCount > 99 ? '99+' : totalMentionCount}</span>
            </div>
        );
    } else if (hasUnreads) {
        badgeDiv = (
            <div className='TeamDropdownButton__badge-unreads'/>
        );
    }

    return (
        <button
            disabled={isDisabled}
            className={classNames('TeamDropdownButton', {
                disabled: isDisabled,
                isMenuOpen,
                darkMode,
            })}
            onClick={handleToggleButton}
            onDoubleClick={(event) => {
                event.stopPropagation();
            }}
        >
            <div className='TeamDropdownButton__badge'>
                <i className='icon-server-variant'/>
                {badgeDiv}
            </div>
            <span>{activeServerName}</span>
            <i className='icon-chevron-down'/>
        </button>
    );
};

export default TeamDropdownButton;
