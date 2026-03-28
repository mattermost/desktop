// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import client from '../client/client';
import type {CreateIssueRequest, UpdateIssueRequest, IssueFilters, CreateProjectRequest, CreateLabelRequest, CreateCycleRequest} from '../types/model';

import ActionTypes from './action_types';

type Dispatch = (action: any) => void;
type GetState = () => any;
type ThunkAction = (dispatch: Dispatch, getState: GetState) => Promise<any>;

export function fetchProjects(): ThunkAction {
    return async (dispatch) => {
        const projects = await client.getProjects();
        dispatch({type: ActionTypes.RECEIVED_PROJECTS, data: projects});
        return {data: projects};
    };
}

export function createProject(data: CreateProjectRequest): ThunkAction {
    return async (dispatch) => {
        const project = await client.createProject(data);
        dispatch(fetchProjects());
        dispatch({type: ActionTypes.SET_ACTIVE_PROJECT, data: project.id});
        return {data: project};
    };
}

export function setActiveProject(projectId: string): ThunkAction {
    return async (dispatch) => {
        dispatch({type: ActionTypes.SET_ACTIVE_PROJECT, data: projectId});
        dispatch(fetchIssues(projectId));
        dispatch(fetchLabels(projectId));
        dispatch(fetchCycles(projectId));
    };
}

export function fetchIssues(projectId: string, params?: Record<string, string>): ThunkAction {
    return async (dispatch) => {
        dispatch({type: ActionTypes.SET_LOADING, data: true});
        try {
            const response = await client.getIssues(projectId, params);
            dispatch({type: ActionTypes.RECEIVED_ISSUES, data: response.issues || []});
        } finally {
            dispatch({type: ActionTypes.SET_LOADING, data: false});
        }
    };
}

export function createIssue(projectId: string, data: CreateIssueRequest): ThunkAction {
    return async (dispatch) => {
        const issue = await client.createIssue(projectId, data);
        dispatch({type: ActionTypes.RECEIVED_ISSUE, data: issue});
        dispatch({type: ActionTypes.CLOSE_CREATE_MODAL});
        return {data: issue};
    };
}

export function updateIssue(id: string, data: UpdateIssueRequest): ThunkAction {
    return async (dispatch) => {
        const issue = await client.updateIssue(id, data);
        dispatch({type: ActionTypes.RECEIVED_ISSUE, data: issue});
        return {data: issue};
    };
}

export function deleteIssue(id: string): ThunkAction {
    return async (dispatch) => {
        await client.deleteIssue(id);
        dispatch({type: ActionTypes.ISSUE_DELETED, data: id});
    };
}

export function fetchLabels(projectId: string): ThunkAction {
    return async (dispatch) => {
        const labels = await client.getLabels(projectId);
        dispatch({type: ActionTypes.RECEIVED_LABELS, data: labels});
    };
}

export function createLabel(projectId: string, data: CreateLabelRequest): ThunkAction {
    return async (dispatch) => {
        const label = await client.createLabel(projectId, data);
        dispatch({type: ActionTypes.RECEIVED_LABEL, data: label});
        return {data: label};
    };
}

export function fetchCycles(projectId: string): ThunkAction {
    return async (dispatch) => {
        const cycles = await client.getCycles(projectId);
        dispatch({type: ActionTypes.RECEIVED_CYCLES, data: cycles});
    };
}

export function createCycle(projectId: string, data: CreateCycleRequest): ThunkAction {
    return async (dispatch) => {
        const cycle = await client.createCycle(projectId, data);
        dispatch({type: ActionTypes.RECEIVED_CYCLE, data: cycle});
        return {data: cycle};
    };
}

export function setFilters(filters: Partial<IssueFilters>) {
    return {type: ActionTypes.SET_FILTERS, data: filters};
}

export function openCreateModal(editingIssueId?: string) {
    return {type: ActionTypes.OPEN_CREATE_MODAL, data: editingIssueId || null};
}

export function closeCreateModal() {
    return {type: ActionTypes.CLOSE_CREATE_MODAL};
}
