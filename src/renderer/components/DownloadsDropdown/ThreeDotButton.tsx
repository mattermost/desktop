// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {DownloadedItem} from 'types/config';

type OwnProps = {
    item: DownloadedItem;
}

const ThreeDotButton = ({item}: OwnProps) => {
    const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        console.log({item});
    };

    return (
        <button
            className='DownloadsDropdown__File__Body__ThreeDotButton'
            onClick={onClick}
        >
            <i className='icon-dots-vertical'/>
        </button>
    );
};

export default ThreeDotButton;
