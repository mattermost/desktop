// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import {CLOSE_TEAMS_DROPDOWN, OPEN_TEAMS_DROPDOWN} from 'common/communication';

import '../css/components/TeamDropdownButton.css';

type Props = {
    activeServerName: string;
    totalMentionCount: number;
    isMenuOpen: boolean;
}

const TeamDropdownButton: React.FC<Props> = (props: Props) => {
    const {activeServerName, totalMentionCount, isMenuOpen} = props;

    const handleToggleButton = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        window.ipcRenderer.send(isMenuOpen ? CLOSE_TEAMS_DROPDOWN : OPEN_TEAMS_DROPDOWN);
    };

    return (
        <button
            className={classNames('TeamDropdownButton', {
                open: isMenuOpen,
            })}
            onClick={handleToggleButton}
            onDoubleClick={(event) => {
                event.stopPropagation();
            }}
        >
            {`${totalMentionCount} - ${activeServerName} - ${isMenuOpen ? 'open' : 'closed'}`}
        </button>
    );
};

export default TeamDropdownButton;
