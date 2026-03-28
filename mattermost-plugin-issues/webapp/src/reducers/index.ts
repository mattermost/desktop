// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Issue, IssueLabel, Cycle, Project, IssueFilters} from '../types/model';
import ActionTypes from '../actions/action_types';

export interface PluginState {
    projects: Record<string, Project>;
    activeProjectId: string;
    issues: Record<string, Issue>;
    labels: Record<string, IssueLabel>;
    cycles: Record<string, Cycle>;
    filters: IssueFilters;
    isCreateModalOpen: boolean;
    editingIssueId: string | null;
    loading: boolean;
}

const defaultFilters: IssueFilters = {
    groupBy: 'status',
};

const initialState: PluginState = {
    projects: {},
    activeProjectId: '',
    issues: {},
    labels: {},
    cycles: {},
    filters: defaultFilters,
    isCreateModalOpen: false,
    editingIssueId: null,
    loading: false,
};

function arrayToRecord<T extends {id: string}>(arr: T[]): Record<string, T> {
    const record: Record<string, T> = {};
    for (const item of arr) {
        record[item.id] = item;
    }
    return record;
}

export default function reducer(state: PluginState = initialState, action: {type: string; data?: any}): PluginState {
    switch (action.type) {
    case ActionTypes.RECEIVED_PROJECTS:
        return {
            ...state,
            projects: arrayToRecord(action.data || []),
        };

    case ActionTypes.SET_ACTIVE_PROJECT:
        return {
            ...state,
            activeProjectId: action.data,
            issues: {},
            labels: {},
            cycles: {},
        };

    case ActionTypes.RECEIVED_ISSUES:
        return {
            ...state,
            issues: arrayToRecord(action.data || []),
        };

    case ActionTypes.RECEIVED_ISSUE: {
        const issue = action.data as Issue;
        return {
            ...state,
            issues: {...state.issues, [issue.id]: issue},
        };
    }

    case ActionTypes.ISSUE_DELETED: {
        const {[action.data]: _, ...remaining} = state.issues;
        return {...state, issues: remaining};
    }

    case ActionTypes.RECEIVED_LABELS:
        return {
            ...state,
            labels: arrayToRecord(action.data || []),
        };

    case ActionTypes.RECEIVED_LABEL: {
        const label = action.data as IssueLabel;
        return {
            ...state,
            labels: {...state.labels, [label.id]: label},
        };
    }

    case ActionTypes.LABEL_DELETED: {
        const {[action.data]: __, ...remainingLabels} = state.labels;
        return {...state, labels: remainingLabels};
    }

    case ActionTypes.RECEIVED_CYCLES:
        return {
            ...state,
            cycles: arrayToRecord(action.data || []),
        };

    case ActionTypes.RECEIVED_CYCLE: {
        const cycle = action.data as Cycle;
        return {
            ...state,
            cycles: {...state.cycles, [cycle.id]: cycle},
        };
    }

    case ActionTypes.CYCLE_DELETED: {
        const {[action.data]: ___, ...remainingCycles} = state.cycles;
        return {...state, cycles: remainingCycles};
    }

    case ActionTypes.SET_FILTERS:
        return {
            ...state,
            filters: {...state.filters, ...action.data},
        };

    case ActionTypes.OPEN_CREATE_MODAL:
        return {
            ...state,
            isCreateModalOpen: true,
            editingIssueId: action.data || null,
        };

    case ActionTypes.CLOSE_CREATE_MODAL:
        return {
            ...state,
            isCreateModalOpen: false,
            editingIssueId: null,
        };

    case ActionTypes.SET_LOADING:
        return {...state, loading: action.data};

    default:
        return state;
    }
}
