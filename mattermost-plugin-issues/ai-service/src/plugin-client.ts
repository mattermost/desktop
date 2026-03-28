// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type { Project, Issue, IssueLabel, Cycle, IssueListResponse, ChannelHistoryResponse } from './types';

export class PluginClient {
    private baseURL: string;
    private secret: string;

    constructor(callbackURL: string, secret: string) {
        this.baseURL = callbackURL.replace(/\/$/, '');
        this.secret = secret;
    }

    private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
        const url = `${this.baseURL}${path}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Secret': this.secret,
                ...(options.headers || {}),
            },
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Plugin API error ${response.status}: ${text}`);
        }
        return response.json() as Promise<T>;
    }

    async listProjects(): Promise<Project[]> {
        return this.request<Project[]>('/internal/projects');
    }

    async listIssues(projectID: string, query?: string): Promise<IssueListResponse> {
        const params = query ? `?q=${encodeURIComponent(query)}` : '';
        return this.request<IssueListResponse>(`/internal/projects/${projectID}/issues${params}`);
    }

    async getIssue(issueID: string): Promise<Issue> {
        return this.request<Issue>(`/internal/issues/${issueID}`);
    }

    async createIssue(projectID: string, data: {
        title: string;
        description?: string;
        status?: string;
        priority?: string;
    }): Promise<Issue> {
        return this.request<Issue>(`/internal/projects/${projectID}/issues`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateIssue(issueID: string, data: {
        title?: string;
        description?: string;
        status?: string;
        priority?: string;
    }): Promise<Issue> {
        return this.request<Issue>(`/internal/issues/${issueID}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async listLabels(projectID: string): Promise<IssueLabel[]> {
        return this.request<IssueLabel[]>(`/internal/projects/${projectID}/labels`);
    }

    async listCycles(projectID: string): Promise<Cycle[]> {
        return this.request<Cycle[]>(`/internal/projects/${projectID}/cycles`);
    }

    async deleteIssue(issueID: string): Promise<{ status: string }> {
        return this.request<{ status: string }>(`/internal/issues/${issueID}`, {
            method: 'DELETE',
        });
    }

    async getChannelHistory(channelID: string, limit?: number, before?: number): Promise<ChannelHistoryResponse> {
        const params = new URLSearchParams();
        if (limit) params.set('limit', String(limit));
        if (before) params.set('before', String(before));
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request<ChannelHistoryResponse>(`/internal/channels/${channelID}/history${query}`);
    }
}
