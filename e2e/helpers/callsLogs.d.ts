// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const CALLS_LOG_UPLOAD_MARKER: string;
export const CALLS_LOG_SEED_MARKER: string;
export const CALLS_LOGS_MODERN_VERSION: string;
export function callsLogsBranch(version: string | null | undefined): 'modern' | 'legacy' | 'unresolved';
