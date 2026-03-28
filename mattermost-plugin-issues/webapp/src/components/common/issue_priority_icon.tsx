// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {IssuePriority} from '../../types/model';
import {PRIORITY_COLORS, PRIORITY_LABELS} from '../../types/model';

interface Props {
    priority: IssuePriority;
    size?: number;
}

const PRIORITY_ICONS: Record<IssuePriority, string> = {
    urgent: '!!!',
    high: '↑',
    medium: '—',
    low: '↓',
    none: '○',
};

const IssuePriorityIcon: React.FC<Props> = ({priority, size = 14}) => {
    const color = PRIORITY_COLORS[priority];
    const icon = PRIORITY_ICONS[priority];

    return (
        <span
            className='issues-priority-icon'
            title={PRIORITY_LABELS[priority]}
            style={{
                color,
                fontSize: `${size}px`,
                fontWeight: 700,
                width: `${size + 4}px`,
                textAlign: 'center',
                display: 'inline-block',
                lineHeight: 1,
            }}
        >
            {icon}
        </span>
    );
};

export default IssuePriorityIcon;
