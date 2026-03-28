// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {IssueStatus} from '../../types/model';
import {STATUS_LABELS, STATUS_COLORS} from '../../types/model';

interface Props {
    status: IssueStatus;
    onClick?: () => void;
}

const IssueStatusBadge: React.FC<Props> = ({status, onClick}) => {
    const color = STATUS_COLORS[status];
    const label = STATUS_LABELS[status];

    return (
        <span
            className='issues-status-badge'
            style={{
                backgroundColor: color + '20',
                color,
                border: `1px solid ${color}40`,
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: onClick ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
            }}
            onClick={onClick}
        >
            {label}
        </span>
    );
};

export default IssueStatusBadge;
