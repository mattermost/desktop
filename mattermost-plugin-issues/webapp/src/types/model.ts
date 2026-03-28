// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
export type IssuePriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';
export type GroupBy = 'status' | 'priority' | 'assignee' | 'cycle' | 'none';

export interface Project {
    id: string;
    name: string;
    prefix: string;
    next_issue_number: number;
    created_by: string;
    created_at: number;
}

export interface Issue {
    id: string;
    project_id: string;
    identifier: string;
    title: string;
    description: string;
    status: IssueStatus;
    priority: IssuePriority;
    label_ids: string[];
    assignee_id: string;
    cycle_id: string;
    estimate_hours: number;
    created_by: string;
    created_at: number;
    updated_at: number;
    completed_at?: number;
    sort_order: number;
}

export interface IssueLabel {
    id: string;
    project_id: string;
    name: string;
    color: string;
}

export interface Cycle {
    id: string;
    project_id: string;
    name: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
}

export interface IssueFilters {
    status?: IssueStatus;
    priority?: IssuePriority;
    assigneeId?: string;
    cycleId?: string;
    searchQuery?: string;
    groupBy: GroupBy;
}

export interface IssueListResponse {
    issues: Issue[];
    total_count: number;
}

export interface CreateIssueRequest {
    title: string;
    description?: string;
    status?: IssueStatus;
    priority?: IssuePriority;
    label_ids?: string[];
    assignee_id?: string;
    cycle_id?: string;
    estimate_hours?: number;
}

export interface UpdateIssueRequest {
    title?: string;
    description?: string;
    status?: IssueStatus;
    priority?: IssuePriority;
    label_ids?: string[];
    assignee_id?: string;
    cycle_id?: string;
    estimate_hours?: number;
    sort_order?: number;
}

export interface CreateProjectRequest {
    name: string;
    prefix: string;
}

export interface CreateLabelRequest {
    name: string;
    color: string;
}

export interface CreateCycleRequest {
    name: string;
    start_date: string;
    end_date: string;
}

export const STATUS_LABELS: Record<IssueStatus, string> = {
    backlog: 'Backlog',
    todo: 'Todo',
    in_progress: 'In Progress',
    in_review: 'In Review',
    done: 'Done',
    cancelled: 'Cancelled',
};

export const PRIORITY_LABELS: Record<IssuePriority, string> = {
    urgent: 'Urgent',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    none: 'No Priority',
};

export const STATUS_ORDER: IssueStatus[] = [
    'backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled',
];

export const PRIORITY_ORDER: IssuePriority[] = [
    'urgent', 'high', 'medium', 'low', 'none',
];

export const STATUS_COLORS: Record<IssueStatus, string> = {
    backlog: '#909399',
    todo: '#409EFF',
    in_progress: '#E6A23C',
    in_review: '#9B59B6',
    done: '#67C23A',
    cancelled: '#F56C6C',
};

export const PRIORITY_COLORS: Record<IssuePriority, string> = {
    urgent: '#F56C6C',
    high: '#E6A23C',
    medium: '#E6A23C',
    low: '#409EFF',
    none: '#909399',
};
