// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DownloadedItem} from 'types/downloads';

import UpdateAvailable from './UpdateAvailable';

import 'renderer/css/components/Button.scss';

type OwnProps = {
    activeItem?: DownloadedItem;
    item: DownloadedItem;
    appName: string;
}

const UpdateWrapper = ({item, appName, activeItem}: OwnProps) => {
    if (item.state === 'available') {
        return (
            <UpdateAvailable
                item={item}
                appName={appName}
                activeItem={activeItem}
            />
        );
    }
    return null;
};

export default UpdateWrapper;
