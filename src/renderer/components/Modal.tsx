// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useRef, useEffect, useCallback} from 'react';
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
    headerContent?: React.ReactNode;
};

export const Modal: React.FC<Props> = ({
    id = 'modal',
    children,
    onExited,
    className,
    modalHeaderText,
    modalSubheaderText,
    show = true,
    handleCancel,
    handleConfirm,
    handleEnterKeyPress,
    handleKeydown,
    confirmButtonText,
    confirmButtonClassName,
    cancelButtonText,
    cancelButtonClassName,
    isConfirmDisabled,
    isDeleteModal,
    autoCloseOnCancelButton = true,
    autoCloseOnConfirmButton = true,
    ariaLabel,
    errorText,
    tabIndex,
    autoFocusConfirmButton,
    headerInput,
    bodyPadding = true,
    bodyDivider,
    footerContent,
    footerDivider,
    appendedContent,
    headerButton,
    headerContent,
}) => {
    const [showState, setShowState] = useState<boolean>();
    const backdropRef = useRef<HTMLDivElement>(null);

    const onClose = useCallback(async () => {
        await onHide();
        onExited();
    }, [onExited]);

    useEffect(() => {
        const escListener = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        async function createEscListener() {
            const uncloseable = await window.desktop.modals.isModalUncloseable();
            if (!uncloseable) {
                window.addEventListener('keydown', escListener);
            }
        }
        createEscListener();
        return () => {
            window.removeEventListener('keydown', escListener);
        };
    }, [onClose]);

    useEffect(() => {
        setShowState(show ?? true);
    }, [show]);

    const onHide = () => {
        return new Promise<void>((resolve) => {
            backdropRef.current?.addEventListener('transitionend', () => {
                resolve();
            }, {once: true});
            setShowState(false);
        });
    };

    const handleCancelClick = async (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault();
        if (autoCloseOnCancelButton) {
            await onHide();
        }
        handleCancel?.();
    };

    const handleConfirmClick = async (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault();
        if (autoCloseOnConfirmButton && !isConfirmDisabled) {
            await onHide();
        }
        handleConfirm?.();
    };

    const onEnterKeyDown = async (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter') {
            if (event.nativeEvent.isComposing) {
                return;
            }
            if (autoCloseOnConfirmButton && !isConfirmDisabled) {
                await onHide();
            }
            if (handleEnterKeyPress) {
                handleEnterKeyPress();
            }
        }
        handleKeydown?.(event);
    };

    let confirmButton;
    if (handleConfirm) {
        const isConfirmOrDeleteClassName = isDeleteModal ? 'delete' : 'confirm';
        let confirmButtonTextNode: React.ReactNode = (
            <FormattedMessage
                id='modal.confirm'
                defaultMessage='Confirm'
            />
        );
        if (confirmButtonText) {
            confirmButtonTextNode = confirmButtonText;
        }

        confirmButton = (
            <button
                id={`${id}_confirm`}
                autoFocus={autoFocusConfirmButton}
                type='submit'
                className={classNames('Modal__button btn btn-primary', isConfirmOrDeleteClassName, confirmButtonClassName, {
                    disabled: isConfirmDisabled,
                })}
                onClick={handleConfirmClick}
                disabled={isConfirmDisabled}
            >
                {confirmButtonTextNode}
            </button>
        );
    }

    let cancelButton;
    if (handleCancel) {
        let cancelButtonTextNode: React.ReactNode = (
            <FormattedMessage
                id='modal.cancel'
                defaultMessage='Cancel'
            />
        );
        if (cancelButtonText) {
            cancelButtonTextNode = cancelButtonText;
        }

        cancelButton = (
            <button
                id={`${id}_cancel`}
                type='button'
                className={classNames('Modal__button btn btn-tertiary', cancelButtonClassName)}
                onClick={handleCancelClick}
            >
                {cancelButtonTextNode}
            </button>
        );
    }

    const headerText = modalHeaderText && (
        <div className='Modal__header'>
            <h1
                id='modalLabel'
                className='Modal_title'
            >
                {modalHeaderText}
            </h1>
            {headerButton}
        </div>
    );

    return (
        <>
            <div
                ref={backdropRef}
                className={classNames('Modal_backdrop fade', {show: showState})}
            />
            <div
                role='dialog'
                className={classNames('Modal fade', {show: showState})}
                onClick={onClose}
            >
                <div
                    id={id}
                    role='dialog'
                    aria-label={ariaLabel}
                    aria-labelledby={ariaLabel ? undefined : 'modalLabel'}
                    className={classNames(
                        'Modal_dialog Modal__compassDesign',
                        className,
                    )}
                    onClick={useCallback((event) => event.stopPropagation(), [])}
                >
                    <div
                        onKeyDown={onEnterKeyDown}
                        tabIndex={tabIndex || 0}
                        className='Modal_content'
                    >
                        <div className='Modal_header'>
                            <div className='Modal__header__text_container'>
                                {headerText}
                                {headerInput}
                                {
                                    modalSubheaderText &&
                                    <div className='Modal_subheading-container'>
                                        <p
                                            id='Modal_subHeading'
                                            className='Modal_subheading'
                                        >
                                            {modalSubheaderText}
                                        </p>
                                    </div>
                                }
                            </div>
                            {headerContent}
                            <button
                                type='button'
                                className='close'
                                onClick={onClose}
                            >
                                <span aria-hidden='true'>{'×'}</span>
                                <span className='sr-only'>{'Close'}</span>
                            </button>
                        </div>
                        <div className={classNames('Modal_body', {divider: bodyDivider})}>
                            {errorText && (
                                <div className='Modal_error'>
                                    <i className='icon icon-alert-outline'/>
                                    <span>{errorText}</span>
                                </div>
                            )}
                            <div className={classNames('Modal__body', {padding: bodyPadding})}>
                                {children}
                            </div>
                        </div>
                        {(cancelButton || confirmButton || footerContent) && (
                            <div className={classNames('Modal_footer', {divider: footerDivider})}>
                                {(cancelButton || confirmButton) ? (
                                    <>
                                        {cancelButton}
                                        {confirmButton}
                                    </>
                                ) : (
                                    footerContent
                                )}
                            </div>
                        )}
                        {Boolean(appendedContent) && appendedContent}
                    </div>
                </div>
            </div>
        </>
    );
};
