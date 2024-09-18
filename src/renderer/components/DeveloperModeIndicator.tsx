// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
// eslint-disable-next-line no-restricted-imports
import {OverlayTrigger, Tooltip} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import 'renderer/css/components/DeveloperModeIndicator.scss';

export default function DeveloperModeIndicator({developerMode, darkMode}: {developerMode: boolean; darkMode: boolean}) {
    if (!developerMode) {
        return null;
    }

    return (
        <OverlayTrigger
            placement='left'
            overlay={
                <Tooltip id='DeveloperModeIndicator__tooltip'>
                    <FormattedMessage
                        id='renderer.components.developerModeIndicator.tooltip'
                        defaultMessage='Developer mode is enabled. You should only have this enabled if a Mattermost developer has instructed you to.'
                    />
                </Tooltip>
            }
        >
            <div className={classNames('DeveloperModeIndicator', {darkMode})}>
                <i className='icon-flask-outline'/>
                <span className='DeveloperModeIndicator__badge'/>
            </div>
        </OverlayTrigger>
    );
}

