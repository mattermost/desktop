// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import 'renderer/css/components/DeveloperModeIndicator.scss';

import WithTooltip from './WithTooltip';

export default function DeveloperModeIndicator({developerMode, darkMode}: {developerMode: boolean; darkMode: boolean}) {
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
            <div className={classNames('DeveloperModeIndicator', {darkMode})}>
                <i className='icon-flask-outline'/>
                <span className='DeveloperModeIndicator__badge'/>
            </div>
        </WithTooltip>
    );
}

