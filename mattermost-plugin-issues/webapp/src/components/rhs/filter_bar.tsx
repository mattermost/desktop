// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {IssueFilters, IssueStatus, IssuePriority, GroupBy, Cycle} from '../../types/model';
import {STATUS_LABELS, PRIORITY_LABELS} from '../../types/model';

interface Props {
    filters: IssueFilters;
    cycles: Cycle[];
    onFilterChange: (filters: Partial<IssueFilters>) => void;
}

const FilterBar: React.FC<Props> = ({filters, cycles, onFilterChange}) => {
    const selectStyle: React.CSSProperties = {
        padding: '4px 6px',
        fontSize: '11px',
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: '4px',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
    };

    return (
        <div
            className='issues-filter-bar'
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '8px 12px',
                borderBottom: '1px solid rgba(0,0,0,0.08)',
            }}
        >
            <input
                type='text'
                placeholder='Search issues...'
                value={filters.searchQuery || ''}
                onChange={(e) => onFilterChange({searchQuery: e.target.value})}
                style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '12px',
                    border: '1px solid rgba(0,0,0,0.12)',
                    borderRadius: '4px',
                    background: 'transparent',
                    color: 'inherit',
                    outline: 'none',
                    boxSizing: 'border-box',
                }}
            />
            <div style={{display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center'}}>
                <select
                    value={filters.status || ''}
                    onChange={(e) => onFilterChange({status: (e.target.value || undefined) as IssueStatus | undefined})}
                    style={selectStyle}
                >
                    <option value=''>{'All statuses'}</option>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </select>
                <select
                    value={filters.priority || ''}
                    onChange={(e) => onFilterChange({priority: (e.target.value || undefined) as IssuePriority | undefined})}
                    style={selectStyle}
                >
                    <option value=''>{'All priorities'}</option>
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </select>
                {cycles.length > 0 && (
                    <select
                        value={filters.cycleId || ''}
                        onChange={(e) => onFilterChange({cycleId: e.target.value || undefined})}
                        style={selectStyle}
                    >
                        <option value=''>{'All cycles'}</option>
                        {cycles.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                )}
                <span style={{flex: 1}} />
                <label style={{fontSize: '11px', color: '#909399', display: 'flex', alignItems: 'center', gap: '4px'}}>
                    {'Group:'}
                    <select
                        value={filters.groupBy}
                        onChange={(e) => onFilterChange({groupBy: e.target.value as GroupBy})}
                        style={selectStyle}
                    >
                        <option value='status'>{'Status'}</option>
                        <option value='priority'>{'Priority'}</option>
                        <option value='assignee'>{'Assignee'}</option>
                        <option value='cycle'>{'Cycle'}</option>
                        <option value='none'>{'None'}</option>
                    </select>
                </label>
            </div>
        </div>
    );
};

export default FilterBar;
