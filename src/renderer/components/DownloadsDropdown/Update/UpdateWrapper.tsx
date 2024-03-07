// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DownloadedItem} from 'types/downloads';

import UpdateAvailable from './UpdateAvailable';
import UpdateDownloaded from './UpdateDownloaded';

import 'renderer/css/components/Button.scss';

type OwnProps = {
    item: DownloadedItem;
    appName: string;
}

const UpdateWrapper = ({item, appName}: OwnProps) => {
    if (item.state === 'available') {
        return (
            <UpdateAvailable
                item={item}
                appName={appName}
            />
        );
    }
    if (item.state === 'completed') {
        return (
            <UpdateDownloaded
                item={item}
                appName={appName}
            />
        );
    }
    return null;
};

export default UpdateWrapper;
