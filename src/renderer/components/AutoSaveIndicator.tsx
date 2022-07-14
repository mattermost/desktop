// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Alert} from 'react-bootstrap';
import {IntlShape, useIntl} from 'react-intl';

const baseClassName = 'AutoSaveIndicator';
const leaveClassName = `${baseClassName}-Leave`;

export enum SavingState {
    SAVING_STATE_SAVING = 'saving',
    SAVING_STATE_SAVED = 'saved',
    SAVING_STATE_ERROR = 'error',
    SAVING_STATE_DONE = 'done',
}

function getClassNameAndMessage(intl: IntlShape, savingState: SavingState, errorMessage?: React.ReactNode) {
    switch (savingState) {
    case SavingState.SAVING_STATE_SAVING:
        return {className: baseClassName, message: intl.formatMessage({id: 'renderer.components.autoSaveIndicator.saving', defaultMessage: 'Saving...'})};
    case SavingState.SAVING_STATE_SAVED:
        return {className: baseClassName, message: intl.formatMessage({id: 'renderer.components.autoSaveIndicator.saved', defaultMessage: 'Saved'})};
    case SavingState.SAVING_STATE_ERROR:
        return {className: `${baseClassName}`, message: errorMessage};
    case SavingState.SAVING_STATE_DONE:
        return {className: `${baseClassName} ${leaveClassName}`, message: intl.formatMessage({id: 'renderer.components.autoSaveIndicator.saved', defaultMessage: 'Saved'})};
    default:
        return {className: `${baseClassName} ${leaveClassName}`, message: ''};
    }
}

type Props = {
    id?: string;
    savingState: SavingState;
    errorMessage?: React.ReactNode;
};

const AutoSaveIndicator: React.FC<Props> = (props: Props) => {
    const intl = useIntl();
    const {savingState, errorMessage, ...rest} = props;
    const {className, message} = getClassNameAndMessage(intl, savingState, errorMessage);
    return (
        <Alert
            className={className}
            {...rest}
            variant={savingState === 'error' ? 'danger' : 'info'}
        >
            {message}
        </Alert>
    );
};

export default AutoSaveIndicator;
