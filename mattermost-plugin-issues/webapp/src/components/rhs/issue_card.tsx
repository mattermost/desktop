// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Issue, IssueLabel} from '../../types/model';
import IssueStatusBadge from '../common/issue_status_badge';
import IssuePriorityIcon from '../common/issue_priority_icon';
import IssueLabelPill from '../common/issue_label_pill';

interface Props {
    issue: Issue;
    labels: Record<string, IssueLabel>;
    onClick: () => void;
}

const IssueCard: React.FC<Props> = ({issue, labels, onClick}) => {
    const issueLabels = issue.label_ids
        .map((id) => labels[id])
        .filter(Boolean);

    return (
        <div
            className='issues-card'
            onClick={onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                cursor: 'pointer',
                borderRadius: '4px',
                transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
            }}
        >
            <IssuePriorityIcon priority={issue.priority} />
            <span
                style={{
                    fontSize: '11px',
                    color: '#909399',
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                }}
            >
                {issue.identifier}
            </span>
            <span
                style={{
                    flex: 1,
                    fontSize: '13px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}
            >
                {issue.title}
            </span>
            <div style={{display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0}}>
                {issueLabels.map((label) => (
                    <IssueLabelPill key={label.id} label={label} />
                ))}
            </div>
            <IssueStatusBadge status={issue.status} />
            {issue.estimate_hours > 0 && (
                <span style={{fontSize: '11px', color: '#909399', whiteSpace: 'nowrap'}}>
                    {issue.estimate_hours}{'h'}
                </span>
            )}
        </div>
    );
};

export default IssueCard;
