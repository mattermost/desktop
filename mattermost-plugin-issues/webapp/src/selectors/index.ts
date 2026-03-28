// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import manifest from '../manifest';
import type {Issue, Project, IssueLabel, Cycle, IssueFilters, IssueStatus, IssuePriority} from '../types/model';
import {STATUS_ORDER, PRIORITY_ORDER} from '../types/model';
import type {PluginState} from '../reducers';

type GlobalState = Record<string, any>;

const getPluginState = (state: GlobalState): PluginState =>
    state[`plugins-${manifest.id}`] as PluginState;

export const getProjects = (state: GlobalState): Record<string, Project> =>
    getPluginState(state).projects;

export const getProjectList = (state: GlobalState): Project[] =>
    Object.values(getPluginState(state).projects);

export const getActiveProjectId = (state: GlobalState): string =>
    getPluginState(state).activeProjectId;

export const getActiveProject = (state: GlobalState): Project | undefined => {
    const s = getPluginState(state);
    return s.projects[s.activeProjectId];
};

export const getIssues = (state: GlobalState): Record<string, Issue> =>
    getPluginState(state).issues;

export const getLabels = (state: GlobalState): Record<string, IssueLabel> =>
    getPluginState(state).labels;

export const getLabelList = (state: GlobalState): IssueLabel[] =>
    Object.values(getPluginState(state).labels);

export const getCycles = (state: GlobalState): Record<string, Cycle> =>
    getPluginState(state).cycles;

export const getCycleList = (state: GlobalState): Cycle[] =>
    Object.values(getPluginState(state).cycles);

export const getFilters = (state: GlobalState): IssueFilters =>
    getPluginState(state).filters;

export const getIsCreateModalOpen = (state: GlobalState): boolean =>
    getPluginState(state).isCreateModalOpen;

export const getEditingIssueId = (state: GlobalState): string | null =>
    getPluginState(state).editingIssueId;

export const getEditingIssue = (state: GlobalState): Issue | undefined => {
    const s = getPluginState(state);
    if (!s.editingIssueId) {
        return undefined;
    }
    return s.issues[s.editingIssueId];
};

export const isLoading = (state: GlobalState): boolean =>
    getPluginState(state).loading;

export const getFilteredIssues = (state: GlobalState): Issue[] => {
    const s = getPluginState(state);
    const {filters} = s;
    let issues = Object.values(s.issues);

    if (filters.status) {
        issues = issues.filter((i) => i.status === filters.status);
    }
    if (filters.priority) {
        issues = issues.filter((i) => i.priority === filters.priority);
    }
    if (filters.assigneeId) {
        issues = issues.filter((i) => i.assignee_id === filters.assigneeId);
    }
    if (filters.cycleId) {
        issues = issues.filter((i) => i.cycle_id === filters.cycleId);
    }
    if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        issues = issues.filter(
            (i) =>
                i.title.toLowerCase().includes(q) ||
                i.description.toLowerCase().includes(q) ||
                i.identifier.toLowerCase().includes(q),
        );
    }

    // Sort by sort_order, then by created_at descending.
    issues.sort((a, b) => {
        if (a.sort_order !== b.sort_order) {
            return a.sort_order - b.sort_order;
        }
        return b.created_at - a.created_at;
    });

    return issues;
};

export const getGroupedIssues = (state: GlobalState): Record<string, Issue[]> => {
    const issues = getFilteredIssues(state);
    const {groupBy} = getFilters(state);

    if (groupBy === 'none') {
        return {all: issues};
    }

    const groups: Record<string, Issue[]> = {};

    if (groupBy === 'status') {
        for (const status of STATUS_ORDER) {
            groups[status] = [];
        }
    } else if (groupBy === 'priority') {
        for (const priority of PRIORITY_ORDER) {
            groups[priority] = [];
        }
    }

    for (const issue of issues) {
        let key: string;
        switch (groupBy) {
        case 'status':
            key = issue.status;
            break;
        case 'priority':
            key = issue.priority;
            break;
        case 'assignee':
            key = issue.assignee_id || 'unassigned';
            break;
        case 'cycle':
            key = issue.cycle_id || 'no_cycle';
            break;
        default:
            key = 'all';
        }
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(issue);
    }

    return groups;
};

export const getOpenIssueCount = (state: GlobalState): number => {
    const issues = Object.values(getPluginState(state).issues);
    return issues.filter((i) => i.status !== 'done' && i.status !== 'cancelled').length;
};
