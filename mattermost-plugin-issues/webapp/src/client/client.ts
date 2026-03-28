// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import manifest from '../manifest';

import type {
    Project, Issue, IssueLabel, Cycle,
    IssueListResponse,
    CreateProjectRequest, CreateIssueRequest, UpdateIssueRequest,
    CreateLabelRequest, CreateCycleRequest,
} from '../types/model';

class Client {
    private baseUrl = '';

    setServerRoute(serverUrl: string) {
        this.baseUrl = `${serverUrl}/plugins/${manifest.id}/api/v1`;
    }

    // Projects
    getProjects = (): Promise<Project[]> => this.doGet('/projects');
    createProject = (data: CreateProjectRequest): Promise<Project> => this.doPost('/projects', data);
    getProject = (id: string): Promise<Project> => this.doGet(`/projects/${id}`);
    updateProject = (id: string, data: Partial<CreateProjectRequest>): Promise<Project> => this.doPut(`/projects/${id}`, data);
    deleteProject = (id: string): Promise<void> => this.doDelete(`/projects/${id}`);

    // Issues
    getIssues = (projectId: string, params?: Record<string, string>): Promise<IssueListResponse> => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.doGet(`/projects/${projectId}/issues${query}`);
    };
    createIssue = (projectId: string, data: CreateIssueRequest): Promise<Issue> => this.doPost(`/projects/${projectId}/issues`, data);
    getIssue = (id: string): Promise<Issue> => this.doGet(`/issues/${id}`);
    updateIssue = (id: string, data: UpdateIssueRequest): Promise<Issue> => this.doPut(`/issues/${id}`, data);
    deleteIssue = (id: string): Promise<void> => this.doDelete(`/issues/${id}`);

    // Labels
    getLabels = (projectId: string): Promise<IssueLabel[]> => this.doGet(`/projects/${projectId}/labels`);
    createLabel = (projectId: string, data: CreateLabelRequest): Promise<IssueLabel> => this.doPost(`/projects/${projectId}/labels`, data);
    updateLabel = (id: string, data: Partial<CreateLabelRequest>): Promise<IssueLabel> => this.doPut(`/labels/${id}`, data);
    deleteLabel = (id: string): Promise<void> => this.doDelete(`/labels/${id}`);

    // Cycles
    getCycles = (projectId: string): Promise<Cycle[]> => this.doGet(`/projects/${projectId}/cycles`);
    createCycle = (projectId: string, data: CreateCycleRequest): Promise<Cycle> => this.doPost(`/projects/${projectId}/cycles`, data);
    updateCycle = (id: string, data: Partial<CreateCycleRequest & {is_active: boolean}>): Promise<Cycle> => this.doPut(`/cycles/${id}`, data);
    deleteCycle = (id: string): Promise<void> => this.doDelete(`/cycles/${id}`);

    // Context (aggregated views)
    getGeneralContext = (): Promise<any> => this.doGet('/context/general');
    getProjectContext = (projectId: string): Promise<any> => this.doGet(`/projects/${projectId}/context`);
    getIssueContext = (issueId: string): Promise<any> => this.doGet(`/issues/${issueId}/context`);

    // HTTP helpers
    private async doGet<T>(path: string): Promise<T> {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method: 'GET',
            headers: this.getHeaders(),
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error(`GET ${path} failed: ${response.status}`);
        }
        return response.json();
    }

    private async doPost<T>(path: string, body: unknown): Promise<T> {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method: 'POST',
            headers: this.getHeaders(),
            credentials: 'include',
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw new Error(`POST ${path} failed: ${response.status}`);
        }
        return response.json();
    }

    private async doPut<T>(path: string, body: unknown): Promise<T> {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            credentials: 'include',
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw new Error(`PUT ${path} failed: ${response.status}`);
        }
        return response.json();
    }

    private async doDelete(path: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method: 'DELETE',
            headers: this.getHeaders(),
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error(`DELETE ${path} failed: ${response.status}`);
        }
    }

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        };

        // Try to get the auth token from Mattermost's client.
        // The token is stored in localStorage or in the cookie.
        const token = this.getAuthToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Mattermost CSRF token from meta tag.
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }

        return headers;
    }

    private getAuthToken(): string {
        // Mattermost stores the token in localStorage under different keys
        // depending on version. Try common locations.
        try {
            // Standard Mattermost token storage
            const token = localStorage.getItem('MMTOKEN') ||
                          localStorage.getItem('token') ||
                          '';
            if (token) {
                return token;
            }

            // Try to get from cookie
            const cookies = document.cookie.split(';');
            for (const cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'MMAUTHTOKEN' && value) {
                    return value;
                }
            }
        } catch {
            // Ignore errors
        }
        return '';
    }
}

const client = new Client();
export default client;
