// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useEffect, useRef} from 'react';
import {useIntl, FormattedMessage} from 'react-intl';
import classNames from 'classnames';

import {UniqueServer} from 'types/config';

import {MODAL_TRANSITION_TIMEOUT, URLValidationStatus} from 'common/utils/constants';

import womanLaptop from 'renderer/assets/svg/womanLaptop.svg';

import Header from 'renderer/components/Header';
import Input, {STATUS, SIZE} from 'renderer/components/Input';
import LoadingBackground from 'renderer/components/LoadingScreen/LoadingBackground';
import SaveButton from 'renderer/components/SaveButton/SaveButton';

import 'renderer/css/components/Button.scss';
import 'renderer/css/components/ConfigureServer.scss';
import 'renderer/css/components/LoadingScreen.css';

type ConfigureServerProps = {
    server?: UniqueServer;
    mobileView?: boolean;
    darkMode?: boolean;
    messageTitle?: string;
    messageSubtitle?: string;
    cardTitle?: string;
    alternateLinkMessage?: string;
    alternateLinkText?: string;
    alternateLinkURL?: string;
    onConnect: (data: UniqueServer) => void;
};

function ConfigureServer({
    server,
    mobileView,
    darkMode,
    messageTitle,
    messageSubtitle,
    cardTitle,
    alternateLinkMessage,
    alternateLinkText,
    alternateLinkURL,
    onConnect,
}: ConfigureServerProps) {
    const {formatMessage} = useIntl();

    const {
        name: prevName,
        url: prevURL,
        id,
    } = server || {};

    const mounted = useRef(false);
    const [transition, setTransition] = useState<'inFromRight' | 'outToLeft'>();
    const [name, setName] = useState(prevName || '');
    const [url, setUrl] = useState(prevURL || '');
    const [nameError, setNameError] = useState('');
    const [urlError, setURLError] = useState<{type: STATUS; value: string}>();
    const [showContent, setShowContent] = useState(false);
    const [waiting, setWaiting] = useState(false);

    const [validating, setValidating] = useState(false);
    const validationTimestamp = useRef<number>();
    const validationTimeout = useRef<NodeJS.Timeout>();
    const editing = useRef(false);

    const canSave = name && url && !nameError && !validating && urlError && urlError.type !== STATUS.ERROR;

    useEffect(() => {
        setTransition('inFromRight');
        setShowContent(true);
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const fetchValidationResult = (urlToValidate: string) => {
        setValidating(true);
        setURLError({
            type: STATUS.INFO,
            value: formatMessage({id: 'renderer.components.configureServer.url.validating', defaultMessage: 'Validating...'}),
        });
        const requestTime = Date.now();
        validationTimestamp.current = requestTime;
        validateURL(urlToValidate).then(({validatedURL, serverName, message}) => {
            if (editing.current) {
                setValidating(false);
                setURLError(undefined);
                return;
            }
            if (!validationTimestamp.current || requestTime < validationTimestamp.current) {
                return;
            }
            if (validatedURL) {
                setUrl(validatedURL);
            }
            if (serverName) {
                setName((prev) => {
                    return prev.length ? prev : serverName;
                });
            }
            if (message) {
                setTransition(undefined);
                setURLError(message);
            }
            setValidating(false);
        });
    };

    const validateName = () => {
        const newName = name.trim();

        if (!newName) {
            return formatMessage({
                id: 'renderer.components.newServerModal.error.nameRequired',
                defaultMessage: 'Name is required.',
            });
        }

        return '';
    };

    const validateURL = async (url: string) => {
        let message;
        const validationResult = await window.desktop.validateServerURL(url);

        if (validationResult?.status === URLValidationStatus.Missing) {
            message = {
                type: STATUS.ERROR,
                value: formatMessage({
                    id: 'renderer.components.newServerModal.error.urlRequired',
                    defaultMessage: 'URL is required.',
                }),
            };
        }

        if (validationResult?.status === URLValidationStatus.Invalid) {
            message = {
                type: STATUS.ERROR,
                value: formatMessage({
                    id: 'renderer.components.newServerModal.error.urlIncorrectFormatting',
                    defaultMessage: 'URL is not formatted correctly.',
                }),
            };
        }

        if (validationResult?.status === URLValidationStatus.Insecure) {
            message = {
                type: STATUS.WARNING,
                value: formatMessage({id: 'renderer.components.configureServer.url.insecure', defaultMessage: 'Your server URL is potentially insecure. For best results, use a URL with the HTTPS protocol.'}),
            };
        }

        if (validationResult?.status === URLValidationStatus.NotMattermost) {
            message = {
                type: STATUS.WARNING,
                value: formatMessage({id: 'renderer.components.configureServer.url.notMattermost', defaultMessage: 'The server URL provided does not appear to point to a valid Mattermost server. Please verify the URL and check your connection.'}),
            };
        }

        if (validationResult?.status === URLValidationStatus.URLNotMatched) {
            message = {
                type: STATUS.WARNING,
                value: formatMessage({id: 'renderer.components.configureServer.url.urlNotMatched', defaultMessage: 'The server URL provided does not match the configured Site URL on your Mattermost server. Server version: {serverVersion}'}, {serverVersion: validationResult.serverVersion}),
            };
        }

        if (validationResult?.status === URLValidationStatus.URLUpdated) {
            message = {
                type: STATUS.INFO,
                value: formatMessage({id: 'renderer.components.configureServer.url.urlUpdated', defaultMessage: 'The server URL provided has been updated to match the configured Site URL on your Mattermost server. Server version: {serverVersion}'}, {serverVersion: validationResult.serverVersion}),
            };
        }

        if (validationResult?.status === URLValidationStatus.OK) {
            message = {
                type: STATUS.SUCCESS,
                value: formatMessage({id: 'renderer.components.configureServer.url.ok', defaultMessage: 'Server URL is valid. Server version: {serverVersion}'}, {serverVersion: validationResult.serverVersion}),
            };
        }

        return {
            validatedURL: validationResult.validatedURL,
            serverName: validationResult.serverName,
            message,
        };
    };

    const handleNameOnChange = ({target: {value}}: React.ChangeEvent<HTMLInputElement>) => {
        setName(value);

        if (nameError) {
            setNameError('');
        }
    };

    const handleURLOnChange = ({target: {value}}: React.ChangeEvent<HTMLInputElement>) => {
        setUrl(value);

        if (urlError) {
            setURLError(undefined);
        }

        editing.current = true;
        clearTimeout(validationTimeout.current as unknown as number);
        validationTimeout.current = setTimeout(() => {
            if (!mounted.current) {
                return;
            }
            editing.current = false;
            fetchValidationResult(value);
        }, 1000);
    };

    const handleOnSaveButtonClick = (e: React.MouseEvent) => {
        submit(e);
    };

    const handleOnCardEnterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            submit(e);
        }
    };

    const submit = async (e: React.MouseEvent | React.KeyboardEvent) => {
        e.preventDefault();

        if (!canSave || waiting) {
            return;
        }

        setWaiting(true);

        const nameError = validateName();

        if (nameError) {
            setTransition(undefined);
            setNameError(nameError);
            setWaiting(false);
            return;
        }

        setTransition('outToLeft');

        setTimeout(() => {
            onConnect({
                url,
                name,
                id,
            });
        }, MODAL_TRANSITION_TIMEOUT);
    };

    const getAlternateLink = useCallback(() => {
        if (!alternateLinkURL || !alternateLinkMessage || !alternateLinkText) {
            return undefined;
        }

        return (
            <div className={classNames('alternate-link', transition, {'alternate-link-inverted': darkMode})}>
                <span className='alternate-link__message'>
                    {alternateLinkMessage}
                </span>
                <a
                    className={classNames(
                        'link-button link-small-button alternate-link__link',
                        {'link-button-inverted': darkMode},
                    )}
                    href={alternateLinkURL}
                    target='_blank'
                    rel='noopener noreferrer'
                >
                    {alternateLinkText}
                </a>
            </div>
        );
    }, [transition, darkMode, alternateLinkURL, alternateLinkMessage, alternateLinkText]);

    return (
        <div
            className={classNames(
                'LoadingScreen',
                {'LoadingScreen--darkMode': darkMode},
                'ConfigureServer',
                {'ConfigureServer-inverted': darkMode},
            )}
        >
            <LoadingBackground/>
            <Header
                darkMode={darkMode}
                alternateLink={mobileView ? getAlternateLink() : undefined}
            />
            {showContent && (
                <div className='ConfigureServer__body'>
                    {!mobileView && getAlternateLink()}
                    <div className='ConfigureServer__content'>
                        <div className={classNames('ConfigureServer__message', transition)}>
                            <h1 className='ConfigureServer__message-title'>
                                {messageTitle || formatMessage({id: 'renderer.components.configureServer.title', defaultMessage: 'Let’s connect to a server'})}
                            </h1>
                            <p className='ConfigureServer__message-subtitle'>
                                {messageSubtitle || (
                                    <FormattedMessage
                                        id='renderer.components.configureServer.subtitle'
                                        defaultMessage='Set up your first server to connect to your<br></br>team’s communication hub'
                                        values={{
                                            br: (x: React.ReactNode) => (<><br/>{x}</>),
                                        }}
                                    />)
                                }
                            </p>
                            <div className='ConfigureServer__message-img'>
                                <img
                                    src={womanLaptop}
                                    draggable={false}
                                />
                            </div>
                        </div>
                        <div className={classNames('ConfigureServer__card', transition, {'with-error': nameError || urlError?.type === STATUS.ERROR})}>
                            <div
                                className='ConfigureServer__card-content'
                                onKeyDown={handleOnCardEnterKeyDown}
                                tabIndex={0}
                            >
                                <p className='ConfigureServer__card-title'>
                                    {cardTitle || formatMessage({id: 'renderer.components.configureServer.cardtitle', defaultMessage: 'Enter your server details'})}
                                </p>
                                <div className='ConfigureServer__card-form'>
                                    <Input
                                        name='url'
                                        className='ConfigureServer__card-form-input'
                                        type='text'
                                        inputSize={SIZE.LARGE}
                                        value={url}
                                        onChange={handleURLOnChange}
                                        customMessage={urlError ?? ({
                                            type: STATUS.INFO,
                                            value: formatMessage({id: 'renderer.components.configureServer.url.info', defaultMessage: 'The URL of your Mattermost server'}),
                                        })}
                                        placeholder={formatMessage({id: 'renderer.components.configureServer.url.placeholder', defaultMessage: 'Server URL'})}
                                        disabled={waiting}
                                        darkMode={darkMode}
                                    />
                                    <Input
                                        name='name'
                                        className='ConfigureServer__card-form-input'
                                        containerClassName='ConfigureServer__card-form-input-container'
                                        type='text'
                                        inputSize={SIZE.LARGE}
                                        value={name}
                                        onChange={handleNameOnChange}
                                        customMessage={nameError ? ({
                                            type: STATUS.ERROR,
                                            value: nameError,
                                        }) : ({
                                            type: STATUS.INFO,
                                            value: formatMessage({id: 'renderer.components.configureServer.name.info', defaultMessage: 'The name that will be displayed in your server list'}),
                                        })}
                                        placeholder={formatMessage({id: 'renderer.components.configureServer.name.placeholder', defaultMessage: 'Server display name'})}
                                        disabled={waiting}
                                        darkMode={darkMode}
                                    />
                                    <SaveButton
                                        id='connectConfigureServer'
                                        extraClasses='ConfigureServer__card-form-button'
                                        saving={waiting}
                                        onClick={handleOnSaveButtonClick}
                                        defaultMessage={urlError?.type === STATUS.WARNING ?
                                            formatMessage({id: 'renderer.components.configureServer.connect.override', defaultMessage: 'Connect anyway'}) :
                                            formatMessage({id: 'renderer.components.configureServer.connect.default', defaultMessage: 'Connect'})
                                        }
                                        savingMessage={formatMessage({id: 'renderer.components.configureServer.connect.saving', defaultMessage: 'Connecting…'})}
                                        disabled={!canSave}
                                        darkMode={darkMode}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className='ConfigureServer__footer'/>
        </div>
    );
}

export default ConfigureServer;
