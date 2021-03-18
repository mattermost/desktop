// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import React from 'react';
import {storiesOf} from '@storybook/react';

import {action} from '@storybook/addon-actions';

import UpdaterPage from '../UpdaterPage.jsx';
import '../../css/components/UpdaterPage.css';

/*
appName: propTypes.string.isRequired,
notifyOnly: propTypes.bool.isRequired,
isDownloading: propTypes.bool.isRequired,
progress: propTypes.number,
onClickInstall: propTypes.func.isRequired,
onClickDownload: propTypes.func.isRequired,
onClickReleaseNotes: propTypes.func.isRequired,
onClickRemind: propTypes.func.isRequired,
onClickSkip: propTypes.func.isRequired,
*/
const appName = 'Storybook App';

storiesOf('UpdaterPage', module).
    add('Normal', () => (
        <UpdaterPage
            appName={appName}
            notifyOnly={false}
            isDownloading={false}
            progress={0}
            onClickInstall={action('clicked install')}
            onClickReleaseNotes={action('clicked release notes')}
            onClickRemind={action('clicked remind')}
            onClickSkip={action('clicked skip')}
        />
    )).
    add('NotifyOnly', () => (
        <UpdaterPage
            appName={appName}
            notifyOnly={true}
            onClickDownload={action('clicked download')}
        />
    )).
    add('Downloading', () => (
        <UpdaterPage
            appName={appName}
            isDownloading={true}
            progress={0}
            onClickCancel={action('clicked cancel')}
        />
    ));
