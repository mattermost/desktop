// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import type {Project, CreateProjectRequest} from '../../types/model';

interface Props {
    projects: Project[];
    activeProjectId: string;
    onSelect: (projectId: string) => void;
    onCreate: (data: CreateProjectRequest) => void;
}

const ProjectSelector: React.FC<Props> = ({projects, activeProjectId, onSelect, onCreate}) => {
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPrefix, setNewPrefix] = useState('');

    const handleCreate = () => {
        if (newName.trim() && newPrefix.trim()) {
            onCreate({name: newName.trim(), prefix: newPrefix.trim()});
            setNewName('');
            setNewPrefix('');
            setIsCreating(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCreate();
        } else if (e.key === 'Escape') {
            setIsCreating(false);
        }
    };

    return (
        <div className='issues-project-selector'>
            <select
                className='issues-project-select'
                value={activeProjectId}
                onChange={(e) => onSelect(e.target.value)}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'inherit',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '4px 0',
                    maxWidth: '140px',
                }}
            >
                {projects.length === 0 && (
                    <option value=''>No projects</option>
                )}
                {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                        {p.name}
                    </option>
                ))}
            </select>
            {isCreating ? (
                <div style={{display: 'flex', gap: '4px', marginTop: '4px'}}>
                    <input
                        type='text'
                        placeholder='Name'
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        style={{flex: 1, padding: '4px 8px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '4px'}}
                        autoFocus={true}
                    />
                    <input
                        type='text'
                        placeholder='PREFIX'
                        value={newPrefix}
                        onChange={(e) => setNewPrefix(e.target.value.toUpperCase())}
                        onKeyDown={handleKeyDown}
                        style={{width: '70px', padding: '4px 8px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '4px'}}
                    />
                    <button onClick={handleCreate} style={{padding: '4px 8px', fontSize: '12px', cursor: 'pointer'}}>{'OK'}</button>
                    <button onClick={() => setIsCreating(false)} style={{padding: '4px 8px', fontSize: '12px', cursor: 'pointer'}}>{'✕'}</button>
                </div>
            ) : (
                <button
                    className='issues-new-project-btn'
                    onClick={() => setIsCreating(true)}
                    title='New project'
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '16px',
                        padding: '0 4px',
                        color: 'inherit',
                        opacity: 0.6,
                    }}
                >
                    {'+'}
                </button>
            )}
        </div>
    );
};

export default ProjectSelector;
