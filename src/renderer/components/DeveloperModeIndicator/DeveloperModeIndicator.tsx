// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import WithTooltip from 'renderer/components/WithTooltip';

import './DeveloperModeIndicator.scss';

export default function DeveloperModeIndicator({developerMode}: {developerMode: boolean}) {
    if (!developerMode) {
        return null;
    }

    return (
        <WithTooltip
            title={
                <FormattedMessage
                    id='renderer.components.developerModeIndicator.tooltip'
                    defaultMessage='Developer mode is enabled. You should only have this enabled if a Mattermost developer has instructed you to.'
                />
            }
            isVertical={false}
            className='DeveloperModeIndicator__tooltip'
        >
            <div className='DeveloperModeIndicator'>
                <i className='icon-flask-outline'/>
                <span className='DeveloperModeIndicator__badge'/>
            </div>
        </WithTooltip>
    );
}

