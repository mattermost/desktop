// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Alert} from 'react-bootstrap';

const baseClassName = 'AutoSaveIndicator';
const leaveClassName = `${baseClassName}-Leave`;

export enum SavingState {
    SAVING_STATE_SAVING = 'saving',
    SAVING_STATE_SAVED = 'saved',
    SAVING_STATE_ERROR = 'error',
    SAVING_STATE_DONE = 'done',
}

function getClassNameAndMessage(savingState: SavingState, errorMessage?: string) {
    switch (savingState) {
    case SavingState.SAVING_STATE_SAVING:
        return {className: baseClassName, message: 'Saving...'};
    case SavingState.SAVING_STATE_SAVED:
        return {className: baseClassName, message: 'Saved'};
    case SavingState.SAVING_STATE_ERROR:
        return {className: `${baseClassName}`, message: errorMessage};
    case SavingState.SAVING_STATE_DONE:
        return {className: `${baseClassName} ${leaveClassName}`, message: 'Saved'};
    default:
        return {className: `${baseClassName} ${leaveClassName}`, message: ''};
    }
}

type Props = {
    id?: string;
    savingState: SavingState;
    errorMessage?: string;
};

export default function AutoSaveIndicator(props: Props) {
    const {savingState, errorMessage, ...rest} = props;
    const {className, message} = getClassNameAndMessage(savingState, errorMessage);
    return (
        <Alert
            className={className}
            {...rest}
            variant={savingState === 'error' ? 'danger' : 'info'}
        >
            {message}
        </Alert>
    );
}
