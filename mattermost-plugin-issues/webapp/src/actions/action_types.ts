// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import manifest from '../manifest';

const prefix = `${manifest.id}_`;

const ActionTypes = {
    RECEIVED_PROJECTS: `${prefix}received_projects`,
    RECEIVED_ISSUES: `${prefix}received_issues`,
    RECEIVED_ISSUE: `${prefix}received_issue`,
    ISSUE_DELETED: `${prefix}issue_deleted`,
    RECEIVED_LABELS: `${prefix}received_labels`,
    RECEIVED_LABEL: `${prefix}received_label`,
    LABEL_DELETED: `${prefix}label_deleted`,
    RECEIVED_CYCLES: `${prefix}received_cycles`,
    RECEIVED_CYCLE: `${prefix}received_cycle`,
    CYCLE_DELETED: `${prefix}cycle_deleted`,
    SET_ACTIVE_PROJECT: `${prefix}set_active_project`,
    SET_FILTERS: `${prefix}set_filters`,
    OPEN_CREATE_MODAL: `${prefix}open_create_modal`,
    CLOSE_CREATE_MODAL: `${prefix}close_create_modal`,
    SET_EDITING_ISSUE: `${prefix}set_editing_issue`,
    SET_LOADING: `${prefix}set_loading`,
} as const;

export default ActionTypes;
