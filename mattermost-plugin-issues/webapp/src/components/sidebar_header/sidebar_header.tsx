// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {getOpenIssueCount} from '../../selectors';

declare const ReactRedux: {useSelector: any};
const {useSelector} = ReactRedux;

const SidebarHeader: React.FC = () => {
    const openCount = useSelector(getOpenIssueCount);

    return (
        <div
            className='issues-sidebar-header'
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.72)',
                cursor: 'pointer',
            }}
            title='Open Issues Tracker'
        >
            <span style={{fontSize: '14px'}}>{'📋'}</span>
            <span>{'Issues'}</span>
            {openCount > 0 && (
                <span
                    style={{
                        background: 'rgba(255,255,255,0.2)',
                        borderRadius: '10px',
                        padding: '1px 6px',
                        fontSize: '10px',
                        fontWeight: 600,
                    }}
                >
                    {openCount}
                </span>
            )}
        </div>
    );
};

export default SidebarHeader;
