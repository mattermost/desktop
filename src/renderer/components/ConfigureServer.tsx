// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useEffect} from 'react';
import {useIntl, FormattedMessage} from 'react-intl';
import classNames from 'classnames';

import {UniqueServer} from 'types/config';
import {URLValidationResult} from 'types/server';

import {isValidURL, parseURL} from 'common/utils/url';
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

let validationTimeout: NodeJS.Timeout;

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

    const [transition, setTransition] = useState<'inFromRight' | 'outToLeft'>();
    const [name, setName] = useState(prevName || '');
    const [url, setUrl] = useState(prevURL || '');
    const [nameError, setNameError] = useState('');
    const [urlError, setURLError] = useState('');
    const [showContent, setShowContent] = useState(false);
    const [waiting, setWaiting] = useState(false);

    const [validationResult, setValidationResult] = useState<URLValidationResult>();
    const [validating, setValidating] = useState(false);

    const canSave = name && url && !nameError && !urlError && !validating;

    useEffect(() => {
        setTransition('inFromRight');
        setShowContent(true);
    }, []);

    useEffect(() => {
        clearTimeout(validationTimeout);
        validationTimeout = setTimeout(() => {
            setValidating(true);
            window.desktop.validateServerURL(url).then((validationResult) => {
                setValidationResult(validationResult);
                setValidating(false);
            });
        }, 1000);
    }, [url]);

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

    const validateURL = async (fullURL: string) => {
        if (!fullURL) {
            return formatMessage({
                id: 'renderer.components.newServerModal.error.urlRequired',
                defaultMessage: 'URL is required.',
            });
        }

        if (!parseURL(fullURL)) {
            return formatMessage({
                id: 'renderer.components.newServerModal.error.urlIncorrectFormatting',
                defaultMessage: 'URL is not formatted correctly.',
            });
        }

        if (!isValidURL(fullURL)) {
            return formatMessage({
                id: 'renderer.components.newServerModal.error.urlNeedsHttp',
                defaultMessage: 'URL should start with http:// or https://.',
            });
        }

        return '';
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
            setURLError('');
        }
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

        const urlError = await validateURL(url.trim());

        if (urlError) {
            setTransition(undefined);
            setURLError(urlError);
            setWaiting(false);
            return;
        }

        setTransition('outToLeft');

        setTimeout(() => {
            onConnect({
                url: url.trim(),
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

    const getURLMessage = () => {
        if (urlError) {
            return {
                type: STATUS.ERROR,
                value: urlError,
            };
        }

        if (validating) {
            return {
                type: STATUS.INFO,
                value: formatMessage({id: 'renderer.components.configureServer.url.validating', defaultMessage: 'Validating...'}),
            };
        }

        if (validationResult?.status === URLValidationStatus.Insecure) {
            return {
                type: STATUS.WARNING,
                value: formatMessage({id: 'renderer.components.configureServer.url.insecure', defaultMessage: 'Your server URL is potentially insecure. For best results, use a URL with the HTTPS protocol.'}),
            };
        }

        if (validationResult?.status === URLValidationStatus.NotMattermost) {
            return {
                type: STATUS.WARNING,
                value: formatMessage({id: 'renderer.components.configureServer.url.notMattermost', defaultMessage: 'The server URL provided does not appear to point to a valid Mattermost server. Please verify the URL and check your connection.'}),
            };
        }

        if (validationResult?.status === URLValidationStatus.URLNotMatched) {
            return {
                type: STATUS.WARNING,
                value: formatMessage({id: 'renderer.components.configureServer.url.urlNotMatched', defaultMessage: 'The server URL provided does not match the SiteURL stored on the Mattermost server. For best results, change the URL to match. The configured URL is: {url}'}, {url: validationResult.siteURL}),
            };
        }

        if (validationResult?.status === URLValidationStatus.OK) {
            return {
                type: STATUS.SUCCESS,
                value: formatMessage({id: 'renderer.components.configureServer.url.ok', defaultMessage: 'Server URL is valid. Server version: {serverVersion}'}, {serverVersion: validationResult.serverVersion}),
            };
        }

        return {
            type: STATUS.INFO,
            value: formatMessage({id: 'renderer.components.configureServer.url.info', defaultMessage: 'The URL of your Mattermost server'}),
        };
    };

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
                        <div className={classNames('ConfigureServer__card', transition, {'with-error': nameError || urlError})}>
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
                                        customMessage={getURLMessage()}
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
                                        defaultMessage={formatMessage({id: 'renderer.components.configureServer.connect.default', defaultMessage: 'Connect'})}
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
