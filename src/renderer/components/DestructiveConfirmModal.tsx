// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {GenericModal} from './GenericModal/generic_modal';

type Props = {
    title: string;
    body: React.ReactNode;
    acceptLabel: string;
    cancelLabel: string;
    onHide: () => void;
    onAccept: () => void;
    onCancel: () => void;
};

export default function DestructiveConfirmationModal(props: Props) {
    const {
        title,
        body,
        acceptLabel,
        cancelLabel,
        onAccept,
        onCancel,
        onHide,
        ...rest} = props;
    return (
        <GenericModal
            onExited={onHide}
            isDeleteModal={true}
            modalHeaderText={title}
            handleCancel={onCancel}
            handleConfirm={onAccept}
            confirmButtonText={acceptLabel}
            cancelButtonText={cancelLabel}
            confirmButtonClassName='btn-danger'
            compassDesign={true}
            {...rest}
        >
            {body}
        </GenericModal>
    );
}
