// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect} from 'react';
import {FormattedMessage} from 'react-intl';

import '../css/components/ServerDropdownButton.scss';

type Props = {
    isDisabled?: boolean;
    activeServerName?: string;
    totalMentionCount: number;
    currentMentions: number;
    currentUnread: boolean;
    hasUnreads: boolean;
    isMenuOpen: boolean;
    darkMode: boolean;
}

const ServerDropdownButton: React.FC<Props> = (props: Props) => {
    const {isDisabled, activeServerName, totalMentionCount, currentMentions, currentUnread, hasUnreads, isMenuOpen, darkMode} = props;
    const buttonRef: React.RefObject<HTMLButtonElement> = React.createRef();

    useEffect(() => {
        if (!isMenuOpen) {
            buttonRef.current?.blur();
        }
    }, [isMenuOpen]);

    const handleToggleButton = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (isMenuOpen) {
            window.desktop.closeServersDropdown();
        } else {
            window.desktop.openServersDropdown();
        }
    };

    let badgeDiv: React.ReactNode;
    if (totalMentionCount > 0) {
        badgeDiv = (
            <div className='ServerDropdownButton__badge-unreads mentions'/>
        );
    } else if (hasUnreads) {
        badgeDiv = (
            <div className='ServerDropdownButton__badge-unreads'/>
        );
    }

    let currentServerBadgeDiv: React.ReactNode;
    if (currentMentions > 0) {
        currentServerBadgeDiv = (
            <div className='TabBar-badge'>
                <span>{currentMentions}</span>
            </div>
        );
    } else if (currentUnread) {
        currentServerBadgeDiv = (
            <div className='TabBar-badge unreads'/>
        );
    }

    return (
        <button
            ref={buttonRef}
            disabled={isDisabled}
            className={classNames('ServerDropdownButton', {
                disabled: isDisabled,
                isMenuOpen,
                darkMode,
            })}
            onClick={handleToggleButton}
            onDoubleClick={(event) => {
                event.stopPropagation();
            }}
        >
            <div className='ServerDropdownButton__badge'>
                <i className='icon-server-variant'/>
                {badgeDiv}
            </div>
            {activeServerName && <span>{activeServerName}</span>}
            {!activeServerName &&
                <FormattedMessage
                    id='renderer.components.serverDropdownButton.noServersConfigured'
                    defaultMessage='No servers configured'
                />
            }
            {currentServerBadgeDiv}
            <i className='icon-chevron-down'/>
        </button>
    );
};

export default ServerDropdownButton;
