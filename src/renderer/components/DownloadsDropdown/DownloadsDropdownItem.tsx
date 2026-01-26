// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DownloadedItem} from 'types/downloads';

import DownloadsDropdownItemFile from './DownloadsDropdownItemFile';
import UpdateWrapper from './Update/UpdateWrapper';

type OwnProps = {
    activeItem?: DownloadedItem;
    item: DownloadedItem;
    appName: string;
}

const DownloadsDropdownItem = ({item, activeItem, appName}: OwnProps) => {
    if (item.type === 'update' && item.state !== 'progressing') {
        return (
            <UpdateWrapper
                item={item}
                appName={appName}
            />
        );
    }

    return (
        <DownloadsDropdownItemFile
            item={item}
            activeItem={activeItem}
            appName={appName}
        />
    );
};

export default DownloadsDropdownItem;
