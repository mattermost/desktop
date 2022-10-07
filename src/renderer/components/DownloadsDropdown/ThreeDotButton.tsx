// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';
import {DownloadedItem} from 'types/downloads';

import classNames from 'classnames';

import {TOGGLE_DOWNLOADS_DROPDOWN_MENU} from 'common/communication';

type OwnProps = {
    activeItem?: DownloadedItem;
    item: DownloadedItem;
    visible: boolean;
}

const ThreeDotButton = ({item, activeItem, visible}: OwnProps) => {
    const buttonElement = useRef<HTMLButtonElement>(null);

    const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();

        const coords = buttonElement.current?.getBoundingClientRect();
        window.postMessage({
            type: TOGGLE_DOWNLOADS_DROPDOWN_MENU,
            payload: {
                coordinates: coords?.toJSON(),
                item,
            },
        }, window.location.href);
    };

    return (
        <button
            className={classNames('DownloadsDropdown__File__Body__ThreeDotButton', {
                active: item.location && (item.location === activeItem?.location),
                visible,
            })}
            onClick={onClick}
            ref={buttonElement}
        >
            <i className='icon-dots-vertical'/>
        </button>
    );
};

export default ThreeDotButton;
