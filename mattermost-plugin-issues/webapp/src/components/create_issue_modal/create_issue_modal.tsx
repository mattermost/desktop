// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback} from 'react';

import {
    getIsCreateModalOpen, getEditingIssue, getActiveProjectId,
    getLabelList, getCycleList,
} from '../../selectors';
import {createIssue, updateIssue, deleteIssue, closeCreateModal} from '../../actions';
import type {
    CreateIssueRequest, IssueStatus, IssuePriority,
} from '../../types/model';
import {STATUS_LABELS, PRIORITY_LABELS} from '../../types/model';

declare const ReactRedux: {useSelector: any; useDispatch: any};
const {useSelector, useDispatch} = ReactRedux;

const CreateIssueModal: React.FC = () => {
    const dispatch = useDispatch();
    const isOpen = useSelector(getIsCreateModalOpen);
    const editingIssue = useSelector(getEditingIssue);
    const activeProjectId = useSelector(getActiveProjectId);
    const labels = useSelector(getLabelList);
    const cycles = useSelector(getCycleList);

    const isEditing = Boolean(editingIssue);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<IssueStatus>('backlog');
    const [priority, setPriority] = useState<IssuePriority>('none');
    const [labelIds, setLabelIds] = useState<string[]>([]);
    const [cycleId, setCycleId] = useState('');
    const [estimateHours, setEstimateHours] = useState('');
    const [assigneeId, setAssigneeId] = useState('');

    useEffect(() => {
        if (editingIssue) {
            setTitle(editingIssue.title);
            setDescription(editingIssue.description);
            setStatus(editingIssue.status);
            setPriority(editingIssue.priority);
            setLabelIds(editingIssue.label_ids || []);
            setCycleId(editingIssue.cycle_id || '');
            setEstimateHours(editingIssue.estimate_hours ? String(editingIssue.estimate_hours) : '');
            setAssigneeId(editingIssue.assignee_id || '');
        } else {
            setTitle('');
            setDescription('');
            setStatus('backlog');
            setPriority('none');
            setLabelIds([]);
            setCycleId('');
            setEstimateHours('');
            setAssigneeId('');
        }
    }, [editingIssue, isOpen]);

    const handleSubmit = useCallback(() => {
        if (!title.trim()) {
            return;
        }

        const data: CreateIssueRequest = {
            title: title.trim(),
            description,
            status,
            priority,
            label_ids: labelIds,
            cycle_id: cycleId || undefined,
            estimate_hours: estimateHours ? parseFloat(estimateHours) : undefined,
            assignee_id: assigneeId || undefined,
        };

        if (isEditing && editingIssue) {
            dispatch(updateIssue(editingIssue.id, data));
            dispatch(closeCreateModal());
        } else {
            dispatch(createIssue(activeProjectId, data));
        }
    }, [dispatch, title, description, status, priority, labelIds, cycleId, estimateHours, assigneeId, isEditing, editingIssue, activeProjectId]);

    const handleDelete = useCallback(() => {
        if (editingIssue && window.confirm(`Delete "${editingIssue.identifier} ${editingIssue.title}"?`)) {
            dispatch(deleteIssue(editingIssue.id));
            dispatch(closeCreateModal());
        }
    }, [dispatch, editingIssue]);

    const handleCancel = useCallback(() => {
        dispatch(closeCreateModal());
    }, [dispatch]);

    const toggleLabel = (labelId: string) => {
        setLabelIds((prev) =>
            prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId],
        );
    };

    if (!isOpen) {
        return null;
    }

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '8px 10px',
        fontSize: '13px',
        border: '1px solid rgba(0,0,0,0.15)',
        borderRadius: '4px',
        background: 'transparent',
        color: 'inherit',
        outline: 'none',
        boxSizing: 'border-box',
    };

    const labelStyle: React.CSSProperties = {
        fontSize: '12px',
        fontWeight: 600,
        color: '#606266',
        marginBottom: '4px',
        display: 'block',
    };

    return (
        <div
            className='issues-modal-backdrop'
            onClick={handleCancel}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
            }}
        >
            <div
                className='issues-modal'
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: '#fff',
                    borderRadius: '8px',
                    width: '480px',
                    maxHeight: '85vh',
                    overflow: 'auto',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                }}
            >
                <div style={{padding: '20px 24px 0', borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: '16px'}}>
                    <h3 style={{margin: 0, fontSize: '16px', fontWeight: 600}}>
                        {isEditing ? `Edit ${editingIssue?.identifier}` : 'New Issue'}
                    </h3>
                </div>

                <div style={{padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px'}}>
                    <div>
                        <label style={labelStyle}>{'Title *'}</label>
                        <input
                            type='text'
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder='Issue title'
                            style={inputStyle}
                            autoFocus={true}
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>{'Description'}</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder='Add a description...'
                            rows={3}
                            style={{...inputStyle, resize: 'vertical'}}
                        />
                    </div>

                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
                        <div>
                            <label style={labelStyle}>{'Status'}</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as IssueStatus)}
                                style={inputStyle}
                            >
                                {Object.entries(STATUS_LABELS).map(([val, lbl]) => (
                                    <option key={val} value={val}>{lbl}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>{'Priority'}</label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value as IssuePriority)}
                                style={inputStyle}
                            >
                                {Object.entries(PRIORITY_LABELS).map(([val, lbl]) => (
                                    <option key={val} value={val}>{lbl}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
                        <div>
                            <label style={labelStyle}>{'Estimate (hours)'}</label>
                            <input
                                type='number'
                                value={estimateHours}
                                onChange={(e) => setEstimateHours(e.target.value)}
                                placeholder='0'
                                min='0'
                                step='0.5'
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>{'Cycle'}</label>
                            <select
                                value={cycleId}
                                onChange={(e) => setCycleId(e.target.value)}
                                style={inputStyle}
                            >
                                <option value=''>{'None'}</option>
                                {cycles.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {labels.length > 0 && (
                        <div>
                            <label style={labelStyle}>{'Labels'}</label>
                            <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px'}}>
                                {labels.map((label) => {
                                    const selected = labelIds.includes(label.id);
                                    return (
                                        <button
                                            key={label.id}
                                            onClick={() => toggleLabel(label.id)}
                                            style={{
                                                padding: '3px 10px',
                                                borderRadius: '12px',
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                border: `1px solid ${label.color}`,
                                                background: selected ? label.color + '30' : 'transparent',
                                                color: label.color,
                                            }}
                                        >
                                            {label.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div>
                        <label style={labelStyle}>{'Assignee (User ID)'}</label>
                        <input
                            type='text'
                            value={assigneeId}
                            onChange={(e) => setAssigneeId(e.target.value)}
                            placeholder='Mattermost user ID'
                            style={inputStyle}
                        />
                    </div>
                </div>

                <div style={{
                    padding: '16px 24px',
                    borderTop: '1px solid rgba(0,0,0,0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '8px',
                }}>
                    <div>
                        {isEditing && (
                            <button
                                onClick={handleDelete}
                                style={{
                                    padding: '8px 16px',
                                    fontSize: '13px',
                                    color: '#F56C6C',
                                    background: 'transparent',
                                    border: '1px solid #F56C6C',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                }}
                            >
                                {'Delete'}
                            </button>
                        )}
                    </div>
                    <div style={{display: 'flex', gap: '8px'}}>
                        <button
                            onClick={handleCancel}
                            style={{
                                padding: '8px 16px',
                                fontSize: '13px',
                                background: 'transparent',
                                border: '1px solid rgba(0,0,0,0.15)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                color: 'inherit',
                            }}
                        >
                            {'Cancel'}
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!title.trim()}
                            style={{
                                padding: '8px 16px',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#fff',
                                background: title.trim() ? '#166DE0' : '#ccc',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: title.trim() ? 'pointer' : 'not-allowed',
                            }}
                        >
                            {isEditing ? 'Save' : 'Create'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateIssueModal;
