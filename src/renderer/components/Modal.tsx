// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useRef, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';

import 'renderer/css/components/Modal.scss';

export type Props = {
    id: string;
    children: React.ReactNode;
    onExited: () => void;

    className?: string;
    modalHeaderText?: React.ReactNode;
    modalSubheaderText?: React.ReactNode;
    show?: boolean;
    handleCancel?: () => void;
    handleConfirm?: () => void;
    handleEnterKeyPress?: () => void;
    handleKeydown?: (event?: React.KeyboardEvent<HTMLDivElement>) => void;
    confirmButtonText?: React.ReactNode;
    confirmButtonClassName?: string;
    cancelButtonText?: React.ReactNode;
    cancelButtonClassName?: string;
    isConfirmDisabled?: boolean;
    isDeleteModal?: boolean;
    autoCloseOnCancelButton?: boolean;
    autoCloseOnConfirmButton?: boolean;
    ariaLabel?: string;
    errorText?: string | React.ReactNode;
    tabIndex?: number;
    autoFocusConfirmButton?: boolean;
    headerInput?: React.ReactNode;
    bodyPadding?: boolean;
    bodyDivider?: boolean;
    footerContent?: React.ReactNode;
    footerDivider?: boolean;
    appendedContent?: React.ReactNode;
    headerButton?: React.ReactNode;
};

export const Modal: React.FC<Props> = (props) => {
    const [show, setShow] = useState<boolean>();
    const backdropRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setShow(props.show ?? true);
    }, [props.show]);

    const onHide = () => {
        return new Promise<void>((resolve) => {
            backdropRef.current?.addEventListener('transitionend', () => {
                resolve();
            }, {once: true});
            setShow(false);
        });
    };

    const onClose = async () => {
        await onHide();
        props.onExited();
    };

    const handleCancel = async (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault();
        if (props.autoCloseOnCancelButton) {
            await onHide();
        }
        if (props.handleCancel) {
            props.handleCancel();
        }
    };

    const handleConfirm = async (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault();
        if (props.autoCloseOnConfirmButton) {
            await onHide();
        }
        props.handleConfirm?.();
    };

    const onEnterKeyDown = async (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter') {
            if (event.nativeEvent.isComposing) {
                return;
            }
            if (props.autoCloseOnConfirmButton) {
                await onHide();
            }
            if (props.handleEnterKeyPress) {
                props.handleEnterKeyPress();
            }
        }
        props.handleKeydown?.(event);
    };

    let confirmButton;
    if (props.handleConfirm) {
        const isConfirmOrDeleteClassName = props.isDeleteModal ? 'delete' : 'confirm';
        let confirmButtonText: React.ReactNode = (
            <FormattedMessage
                id='modal.confirm'
                defaultMessage='Confirm'
            />
        );
        if (props.confirmButtonText) {
            confirmButtonText = props.confirmButtonText;
        }

        confirmButton = (
            <button
                id={`${props.id}_confirm`}
                autoFocus={props.autoFocusConfirmButton}
                type='submit'
                className={classNames('Modal__button btn btn-primary', isConfirmOrDeleteClassName, props.confirmButtonClassName, {
                    disabled: props.isConfirmDisabled,
                })}
                onClick={handleConfirm}
                disabled={props.isConfirmDisabled}
            >
                {confirmButtonText}
            </button>
        );
    }

    let cancelButton;
    if (props.handleCancel) {
        let cancelButtonText: React.ReactNode = (
            <FormattedMessage
                id='modal.cancel'
                defaultMessage='Cancel'
            />
        );
        if (props.cancelButtonText) {
            cancelButtonText = props.cancelButtonText;
        }

        cancelButton = (
            <button
                id={`${props.id}_cancel`}
                type='button'
                className={classNames('Modal__button btn btn-tertiary', props.cancelButtonClassName)}
                onClick={handleCancel}
            >
                {cancelButtonText}
            </button>
        );
    }

    const headerText = props.modalHeaderText && (
        <div className='Modal__header'>
            <h1
                id='modalLabel'
                className='Modal_title'
            >
                {props.modalHeaderText}
            </h1>
            {props.headerButton}
        </div>
    );

    return (
        <>
            <div
                ref={backdropRef}
                className={classNames('Modal_backdrop fade', {show})}
            />
            <div
                role='dialog'
                className={classNames('Modal fade', {show})}
                onClick={onClose}
            >
                <div
                    id={props.id}
                    role='dialog'
                    aria-label={props.ariaLabel}
                    aria-labelledby={props.ariaLabel ? undefined : 'modalLabel'}
                    className={classNames(
                        'Modal_dialog Modal__compassDesign',
                        props.className,
                    )}
                    onClick={(event) => event.stopPropagation()}
                >
                    <div
                        onKeyDown={onEnterKeyDown}
                        tabIndex={props.tabIndex || 0}
                        className='Modal_content'
                    >
                        <div className='Modal_header'>
                            <div className='Modal__header__text_container'>
                                {headerText}
                                {props.headerInput}
                                {
                                    props.modalSubheaderText &&
                                    <div className='Modal_subheading-container'>
                                        <p
                                            id='Modal_subHeading'
                                            className='Modal_subheading'
                                        >
                                            {props.modalSubheaderText}
                                        </p>
                                    </div>
                                }
                            </div>
                            <button
                                type='button'
                                className='close'
                                onClick={onClose}
                            >
                                <span aria-hidden='true'>{'×'}</span>
                                <span className='sr-only'>{'Close'}</span>
                            </button>
                        </div>
                        <div className={classNames('Modal_body', {divider: props.bodyDivider})}>
                            {props.errorText && (
                                <div className='Modal_error'>
                                    <i className='icon icon-alert-outline'/>
                                    <span>{props.errorText}</span>
                                </div>
                            )}
                            <div className={classNames('Modal__body', {padding: props.bodyPadding})}>
                                {props.children}
                            </div>
                        </div>
                        {(cancelButton || confirmButton || props.footerContent) && (
                            <div className={classNames('Modal_footer', {divider: props.footerDivider})}>
                                {(cancelButton || confirmButton) ? (
                                    <>
                                        {cancelButton}
                                        {confirmButton}
                                    </>
                                ) : (
                                    props.footerContent
                                )}
                            </div>
                        )}
                        {Boolean(props.appendedContent) && props.appendedContent}
                    </div>
                </div>
            </div>
        </>
    );
};

Modal.defaultProps = {
    show: true,
    id: 'modal',
    autoCloseOnCancelButton: true,
    autoCloseOnConfirmButton: true,
    bodyPadding: true,
};
