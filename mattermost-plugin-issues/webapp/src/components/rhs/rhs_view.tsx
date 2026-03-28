// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useCallback} from 'react';

import {
    getProjectList, getActiveProjectId, getLabels, getCycleList,
    getGroupedIssues, getFilters, isLoading,
} from '../../selectors';
import {
    fetchProjects, fetchIssues, fetchLabels, fetchCycles,
    setActiveProject, setFilters, openCreateModal, createProject,
} from '../../actions';
import type {IssueFilters, CreateProjectRequest} from '../../types/model';

import RHSHeader from './rhs_header';
import FilterBar from './filter_bar';
import IssueList from './issue_list';

// The RHS component receives the Redux store via props from the plugin registration.
// Mattermost provides useSelector/useDispatch via the ReactRedux external.
declare const ReactRedux: {useSelector: any; useDispatch: any};
const {useSelector, useDispatch} = ReactRedux;

const RHSView: React.FC = () => {
    console.log('[Issues Plugin] RHSView rendering');
    const dispatch = useDispatch();
    const projects = useSelector(getProjectList);
    const activeProjectId = useSelector(getActiveProjectId);
    const labels = useSelector(getLabels);
    const cycles = useSelector(getCycleList);
    const groupedIssues = useSelector(getGroupedIssues);
    const filters = useSelector(getFilters);
    const loading = useSelector(isLoading);

    console.log('[Issues Plugin] RHSView state:', {projects, activeProjectId, groupedIssues, loading});

    useEffect(() => {
        dispatch(fetchProjects());
    }, [dispatch]);

    // Auto-select first project if none is selected.
    useEffect(() => {
        if (!activeProjectId && projects.length > 0) {
            dispatch(setActiveProject(projects[0].id));
        }
    }, [dispatch, activeProjectId, projects]);

    // Fetch data when active project changes.
    useEffect(() => {
        if (activeProjectId) {
            dispatch(fetchIssues(activeProjectId));
            dispatch(fetchLabels(activeProjectId));
            dispatch(fetchCycles(activeProjectId));
        }
    }, [dispatch, activeProjectId]);

    const handleSelectProject = useCallback((id: string) => {
        dispatch(setActiveProject(id));
    }, [dispatch]);

    const handleCreateProject = useCallback((data: CreateProjectRequest) => {
        dispatch(createProject(data));
    }, [dispatch]);

    const handleFilterChange = useCallback((newFilters: Partial<IssueFilters>) => {
        dispatch(setFilters(newFilters));
    }, [dispatch]);

    const handleNewIssue = useCallback(() => {
        dispatch(openCreateModal());
    }, [dispatch]);

    const handleClickIssue = useCallback((issueId: string) => {
        dispatch(openCreateModal(issueId));
    }, [dispatch]);

    return (
        <div
            className='issues-rhs'
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
        >
            <RHSHeader
                projects={projects}
                activeProjectId={activeProjectId}
                onSelectProject={handleSelectProject}
                onCreateProject={handleCreateProject}
                onNewIssue={handleNewIssue}
            />
            <FilterBar
                filters={filters}
                cycles={cycles}
                onFilterChange={handleFilterChange}
            />
            {loading ? (
                <div style={{padding: '40px 16px', textAlign: 'center', color: '#909399', fontSize: '13px'}}>
                    {'Loading...'}
                </div>
            ) : (
                <IssueList
                    groupedIssues={groupedIssues}
                    labels={labels}
                    filters={filters}
                    onClickIssue={handleClickIssue}
                />
            )}
        </div>
    );
};

export default RHSView;
