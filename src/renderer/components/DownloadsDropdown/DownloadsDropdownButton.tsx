// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect} from 'react';

import {CLOSE_DOWNLOADS_DROPDOWN, OPEN_DOWNLOADS_DROPDOWN} from 'common/communication';

import '../../css/components/DownloadsDropdown/DownloadsDropdownButton.scss';

type Props = {
    isDownloadsDropdownOpen: boolean;
    darkMode: boolean;
    showDownloadsBadge: boolean;
}

const DownloadsDropDownButtonBadge = ({show}: { show: boolean }) => (
    show ? <span className='DownloadsDropdownButton__badge'/> : null
);

const DownloadsDropdownButton: React.FC<Props> = ({darkMode, isDownloadsDropdownOpen, showDownloadsBadge}: Props) => {
    const buttonRef: React.RefObject<HTMLButtonElement> = React.createRef();

    useEffect(() => {
        if (!isDownloadsDropdownOpen) {
            buttonRef.current?.blur();
        }
    }, [isDownloadsDropdownOpen, buttonRef]);

    const handleToggleButton = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        window.ipcRenderer.send(isDownloadsDropdownOpen ? CLOSE_DOWNLOADS_DROPDOWN : OPEN_DOWNLOADS_DROPDOWN);
    };

    return (
        <button
            ref={buttonRef}
            className={classNames('DownloadsDropdownButton', {
                isDownloadsDropdownOpen,
                darkMode,
            })}
            onClick={handleToggleButton}
            onDoubleClick={(event) => {
                event.stopPropagation();
            }}
        >
            <i className='icon-arrow-down-bold-circle-outline'/>
            <DownloadsDropDownButtonBadge show={showDownloadsBadge}/>
        </button>
    );
};

export default DownloadsDropdownButton;
