// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import type {Issue, IssueLabel, IssueStatus, IssuePriority} from '../../types/model';
import {STATUS_LABELS, PRIORITY_LABELS, STATUS_COLORS, PRIORITY_COLORS} from '../../types/model';
import type {IssueFilters} from '../../types/model';
import IssueCard from './issue_card';

interface Props {
    groupedIssues: Record<string, Issue[]>;
    labels: Record<string, IssueLabel>;
    filters: IssueFilters;
    onClickIssue: (issueId: string) => void;
}

function getGroupLabel(key: string, groupBy: string): string {
    if (groupBy === 'status') {
        return STATUS_LABELS[key as IssueStatus] || key;
    }
    if (groupBy === 'priority') {
        return PRIORITY_LABELS[key as IssuePriority] || key;
    }
    if (key === 'unassigned') {
        return 'Unassigned';
    }
    if (key === 'no_cycle') {
        return 'No Cycle';
    }
    return key;
}

function getGroupColor(key: string, groupBy: string): string {
    if (groupBy === 'status') {
        return STATUS_COLORS[key as IssueStatus] || '#909399';
    }
    if (groupBy === 'priority') {
        return PRIORITY_COLORS[key as IssuePriority] || '#909399';
    }
    return '#909399';
}

const IssueList: React.FC<Props> = ({groupedIssues, labels, filters, onClickIssue}) => {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const entries = Object.entries(groupedIssues);
    const groupBy = filters.groupBy || 'status';

    if (entries.length === 0) {
        return (
            <div style={{padding: '40px 16px', textAlign: 'center', color: '#909399', fontSize: '13px'}}>
                {'No issues found'}
            </div>
        );
    }

    const totalEstimate = (issues: Issue[]) =>
        issues.reduce((sum, i) => sum + (i.estimate_hours || 0), 0);

    return (
        <div className='issues-list' style={{flex: 1, overflow: 'auto'}}>
            {entries.map(([key, issues]) => {
                // Skip empty groups.
                if (groupBy !== 'none' && issues.length === 0) {
                    return null;
                }
                const isCollapsed = collapsed[key];
                const color = getGroupColor(key, groupBy);
                const estimate = totalEstimate(issues);

                return (
                    <div key={key} className='issues-group'>
                        {groupBy !== 'none' && (
                            <div
                                className='issues-group-header'
                                onClick={() => setCollapsed({...collapsed, [key]: !isCollapsed})}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid rgba(0,0,0,0.08)',
                                    userSelect: 'none',
                                }}
                            >
                                <span style={{fontSize: '12px', color: '#909399'}}>
                                    {isCollapsed ? '▸' : '▾'}
                                </span>
                                <span
                                    style={{
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        color,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                    }}
                                >
                                    {getGroupLabel(key, groupBy)}
                                </span>
                                <span style={{fontSize: '11px', color: '#909399'}}>
                                    {'('}{issues.length}{')'}
                                </span>
                                <span style={{flex: 1}} />
                                {estimate > 0 && (
                                    <span style={{fontSize: '11px', color: '#909399'}}>
                                        {estimate}{'h'}
                                    </span>
                                )}
                            </div>
                        )}
                        {!isCollapsed && issues.map((issue) => (
                            <IssueCard
                                key={issue.id}
                                issue={issue}
                                labels={labels}
                                onClick={() => onClickIssue(issue.id)}
                            />
                        ))}
                    </div>
                );
            })}
        </div>
    );
};

export default IssueList;
