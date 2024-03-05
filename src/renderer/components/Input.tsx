// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useEffect} from 'react';
import {useIntl} from 'react-intl';

import 'renderer/css/components/Input.scss';

export enum STATUS {
    NONE = 'none',
    SUCCESS = 'success',
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
}

export enum SIZE {
    MEDIUM = 'medium',
    LARGE = 'large',
}

export type CustomMessageInputType = {
    type: STATUS;
    value: string;
} | null;

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    required?: boolean;
    hasError?: boolean;
    addon?: React.ReactElement;
    textPrefix?: string;
    inputPrefix?: JSX.Element;
    inputSuffix?: JSX.Element;
    label?: string;
    containerClassName?: string;
    wrapperClassName?: string;
    inputClassName?: string;
    limit?: number;
    useLegend?: boolean;
    customMessage?: CustomMessageInputType;
    inputSize?: SIZE;
    darkMode?: boolean;
}

const Input = React.forwardRef((
    {
        name,
        value,
        label,
        placeholder,
        useLegend = true,
        className,
        hasError,
        required,
        addon,
        textPrefix,
        inputPrefix,
        inputSuffix,
        containerClassName,
        wrapperClassName,
        inputClassName,
        limit,
        customMessage,
        maxLength,
        inputSize = SIZE.MEDIUM,
        disabled,
        darkMode,
        onFocus,
        onBlur,
        onChange,
        ...otherProps
    }: InputProps,
    ref?: React.Ref<HTMLInputElement>,
) => {
    const {formatMessage} = useIntl();

    const [focused, setFocused] = useState(false);
    const [customInputLabel, setCustomInputLabel] = useState<CustomMessageInputType>(null);

    useEffect(() => {
        if (customMessage !== undefined && customMessage !== null && customMessage.value !== '') {
            setCustomInputLabel(customMessage);
        }
    }, [customMessage]);

    const handleOnFocus = (event: React.FocusEvent<HTMLInputElement>) => {
        setFocused(true);

        if (onFocus) {
            onFocus(event);
        }
    };

    const handleOnBlur = (event: React.FocusEvent<HTMLInputElement>) => {
        setFocused(false);
        validateInput();

        if (onBlur) {
            onBlur(event);
        }
    };

    const handleOnChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setCustomInputLabel(null);

        if (onChange) {
            onChange(event);
        }
    };

    const validateInput = () => {
        if (!required || (value !== null && value !== '')) {
            return;
        }
        const validationErrorMsg = formatMessage({id: 'renderer.components.input.required', defaultMessage: 'This field is required'});
        setCustomInputLabel({type: STATUS.ERROR, value: validationErrorMsg});
    };

    const showLegend = Boolean(focused || value);
    const error = customInputLabel?.type === 'error';
    const limitExceeded = limit && value && !Array.isArray(value) ? value.toString().length - limit : 0;

    return (
        <div
            className={classNames(
                'Input_container',
                containerClassName,
                {
                    disabled,
                    'Input_container-inverted': darkMode,
                },
            )}
        >
            <fieldset
                className={classNames('Input_fieldset', className, {
                    Input_fieldset___error: error || hasError || limitExceeded > 0,
                    Input_fieldset___legend: showLegend,
                })}
            >
                {useLegend && (
                    <legend className={classNames('Input_legend', {Input_legend___focus: showLegend})}>
                        {showLegend ? label || placeholder : null}
                    </legend>
                )}
                <div className={classNames('Input_wrapper', wrapperClassName)}>
                    {inputPrefix}
                    {textPrefix && <span>{textPrefix}</span>}
                    <input
                        ref={ref}
                        id={`input_${name || ''}`}
                        className={classNames('Input', inputSize, inputClassName, {Input__focus: showLegend})}
                        value={value}
                        placeholder={focused ? (label && placeholder) || label : label || placeholder}
                        name={name}
                        disabled={disabled}
                        {...otherProps}
                        maxLength={limit ? undefined : maxLength}
                        onFocus={handleOnFocus}
                        onBlur={handleOnBlur}
                        onChange={handleOnChange}
                    />
                    {limitExceeded > 0 && (
                        <span className='Input_limit-exceeded'>
                            {'-'}{limitExceeded}
                        </span>
                    )}
                    {inputSuffix}
                </div>
                {addon}
            </fieldset>
            {customInputLabel && (
                <div
                    id={`customMessage_${name || ''}`}
                    className={`Input___customMessage Input___${customInputLabel.type}`}
                >
                    {customInputLabel.type !== STATUS.INFO && (
                        <i
                            className={classNames(`icon ${customInputLabel.type}`, {
                                'icon-alert-outline': customInputLabel.type === STATUS.WARNING,
                                'icon-alert-circle-outline': customInputLabel.type === STATUS.ERROR,
                                'icon-check': customInputLabel.type === STATUS.SUCCESS,

                                // No icon wanted for info in desktop. Kept for further reference with Input component in webapp
                                // 'icon-information-outline': customInputLabel.type === STATUS.INFO,
                            })}
                        />
                    )}
                    <span>{customInputLabel.value}</span>
                </div>
            )}
        </div>
    );
});

export default Input;
