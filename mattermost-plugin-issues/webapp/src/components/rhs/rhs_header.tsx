// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Project, CreateProjectRequest} from '../../types/model';
import ProjectSelector from '../common/project_selector';

interface Props {
    projects: Project[];
    activeProjectId: string;
    onSelectProject: (id: string) => void;
    onCreateProject: (data: CreateProjectRequest) => void;
    onNewIssue: () => void;
}

const RHSHeader: React.FC<Props> = ({projects, activeProjectId, onSelectProject, onCreateProject, onNewIssue}) => {
    return (
        <div
            className='issues-rhs-header'
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px',
                borderBottom: '1px solid rgba(0,0,0,0.08)',
            }}
        >
            <ProjectSelector
                projects={projects}
                activeProjectId={activeProjectId}
                onSelect={onSelectProject}
                onCreate={onCreateProject}
            />
            <span style={{flex: 1}} />
            <button
                className='issues-new-issue-btn'
                onClick={onNewIssue}
                disabled={!activeProjectId}
                style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#fff',
                    background: '#166DE0',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: activeProjectId ? 'pointer' : 'not-allowed',
                    opacity: activeProjectId ? 1 : 0.5,
                }}
            >
                {'+ New Issue'}
            </button>
        </div>
    );
};

export default RHSHeader;
