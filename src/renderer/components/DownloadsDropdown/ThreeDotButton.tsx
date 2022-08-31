// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState} from 'react';
import {DownloadedItem} from 'types/downloads';

import {CLOSE_DOWNLOADS_DROPDOWN_MENU, OPEN_DOWNLOADS_DROPDOWN_MENU} from 'common/communication';

type OwnProps = {
    item: DownloadedItem;
}

const ThreeDotButton = ({item}: OwnProps) => {
    const [open, setOpen] = useState(false);
    const buttonElement = useRef<HTMLButtonElement>(null);

    const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();

        const coords = buttonElement.current?.getBoundingClientRect();

        if (open) {
            window.postMessage({
                type: CLOSE_DOWNLOADS_DROPDOWN_MENU,
            }, window.location.href);
            setOpen(false);
        } else {
            window.postMessage({
                type: OPEN_DOWNLOADS_DROPDOWN_MENU,
                payload: {
                    coordinates: coords?.toJSON(),
                    item,
                },
            }, window.location.href);
            setOpen(true);
        }
    };

    return (
        <button
            className='DownloadsDropdown__File__Body__ThreeDotButton'
            onClick={onClick}
            ref={buttonElement}
        >
            <i className='icon-dots-vertical'/>
        </button>
    );
};

export default ThreeDotButton;
