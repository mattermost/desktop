// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {IssueLabel} from '../../types/model';

interface Props {
    label: IssueLabel;
}

const IssueLabelPill: React.FC<Props> = ({label}) => {
    return (
        <span
            className='issues-label-pill'
            style={{
                backgroundColor: label.color + '25',
                color: label.color,
                border: `1px solid ${label.color}50`,
                padding: '1px 6px',
                borderRadius: '10px',
                fontSize: '10px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
            }}
        >
            {label.name}
        </span>
    );
};

export default IssueLabelPill;
