// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {DownloadedItem} from 'types/downloads';

import UpdateAvailable from './UpdateAvailable';
import UpdateDownloaded from './UpdateDownloaded';

import 'renderer/css/components/Button.scss';

type OwnProps = {
    item: DownloadedItem;
}

const UpdateWrapper = ({item}: OwnProps) => {
    if (item.state === 'available') {
        return <UpdateAvailable item={item}/>;
    }
    if (item.state === 'completed') {
        return <UpdateDownloaded item={item}/>;
    }
    return null;
};

export default UpdateWrapper;
