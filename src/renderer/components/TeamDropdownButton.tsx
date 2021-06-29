// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import {CLOSE_TEAMS_DROPDOWN, OPEN_TEAMS_DROPDOWN} from 'common/communication';

import '../css/components/TeamDropdownButton.css';
import '../css/compass-icons.css';

type Props = {
    activeServerName: string;
    totalMentionCount: number;
    isMenuOpen: boolean;
    darkMode: boolean;
}

const TeamDropdownButton: React.FC<Props> = (props: Props) => {
    const {activeServerName, totalMentionCount, isMenuOpen, darkMode} = props;

    const handleToggleButton = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        window.ipcRenderer.send(isMenuOpen ? CLOSE_TEAMS_DROPDOWN : OPEN_TEAMS_DROPDOWN);
    };

    return (
        <button
            className={classNames('TeamDropdownButton', {
                open: isMenuOpen,
                darkMode,
            })}
            onClick={handleToggleButton}
            onDoubleClick={(event) => {
                event.stopPropagation();
            }}
        >
            <div className='TeamDropdownButton__badge'>
                <i className='icon-server-variant'/>
                {totalMentionCount > 0 && (
                    <div className='TeamDropdownButton__badge-count'>
                        {totalMentionCount}
                    </div>
                )}
            </div>
            <span>{activeServerName}</span>
            <i className='icon-chevron-down'/>
        </button>
    );
};

export default TeamDropdownButton;
