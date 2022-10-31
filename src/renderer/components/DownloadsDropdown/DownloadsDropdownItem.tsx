// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {DownloadedItem} from 'types/downloads';

import DownloadsDropdownItemFile from './DownloadsDropdownItemFile';
import UpdateWrapper from './Update/UpdateWrapper';

type OwnProps = {
    activeItem?: DownloadedItem;
    item: DownloadedItem;
}

const DownloadsDropdownItem = ({item, activeItem}: OwnProps) => {
    if (item.type === 'update' && item.state !== 'progressing') {
        return <UpdateWrapper item={item}/>;
    }

    return (
        <DownloadsDropdownItemFile
            item={item}
            activeItem={activeItem}
        />
    );
};

export default DownloadsDropdownItem;
