// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface ConversationParticipant {
    user_id: string;
    username: string;
}

export interface ConversationMessage {
    user_id: string;
    username: string;
    message: string;
    timestamp: number;
}

export interface ConversationPayload {
    channel_id: string;
    channel_type: string;
    channel_name: string;
    participants: ConversationParticipant[];
    messages: ConversationMessage[];
    started_at: string;
    ended_at: string;
    duration_seconds: number;
}

export interface AnalyzeRequest {
    conversation: ConversationPayload;
    callback_url: string;
    internal_secret: string;
    openai_api_key: string;
}

export interface AnalyzeResponse {
    summary: string;
    actions_taken: number;
}

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
    status: string;
    priority: string;
    label_ids: string[];
    assignee_id?: string;
    cycle_id?: string;
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

export interface IssueListResponse {
    issues: Issue[];
    total_count: number;
}

export interface ChannelHistoryMessage {
    user_id: string;
    username: string;
    message: string;
    create_at: number;
}

export interface ChannelHistoryResponse {
    channel_id: string;
    messages: ChannelHistoryMessage[];
    count: number;
}
