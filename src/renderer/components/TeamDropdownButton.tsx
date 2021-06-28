// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState} from 'react';

import {CLOSE_TEAMS_DROPDOWN, OPEN_TEAMS_DROPDOWN} from 'common/communication';

import '../css/components/TeamDropdownButton.css';

type Props = {
    activeServerName: string;
    totalMentionCount: number;
}

const TeamDropdownButton: React.FC<Props> = (props: Props) => {
    const {activeServerName, totalMentionCount} = props;
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleToggleButton = () => {
        window.ipcRenderer.send(isMenuOpen ? CLOSE_TEAMS_DROPDOWN : OPEN_TEAMS_DROPDOWN);
        setIsMenuOpen(!isMenuOpen);
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
            {`${totalMentionCount} - ${activeServerName}`}
        </button>
    );
};

export default TeamDropdownButton;
