// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useEffect} from 'react';
import {useIntl, FormattedMessage} from 'react-intl';
import classNames from 'classnames';

import {TeamWithIndex} from 'types/config';

import womanLaptop from 'renderer/assets/svg/womanLaptop.svg';

import Header from 'renderer/components/Header';
import Input, {STATUS, SIZE} from 'renderer/components/Input';
import LoadingBackground from 'renderer/components/LoadingScreen/LoadingBackground';
import SaveButton from 'renderer/components/SaveButton/SaveButton';

import {PING_DOMAIN, PING_DOMAIN_RESPONSE} from 'common/communication';
import {MODAL_TRANSITION_TIMEOUT} from 'common/utils/constants';
import urlUtils from 'common/utils/url';

import 'renderer/css/components/Button.scss';
import 'renderer/css/components/ConfigureServer.scss';
import 'renderer/css/components/LoadingScreen.css';

type ConfigureServerProps = {
    currentTeams: TeamWithIndex[];
    team?: TeamWithIndex;
    mobileView?: boolean;
    darkMode?: boolean;
    messageTitle?: string;
    messageSubtitle?: string;
    cardTitle?: string;
    alternateLinkMessage?: string;
    alternateLinkText?: string;
    alternateLinkURL?: string;
    onConnect: (data: TeamWithIndex) => void;
};

function ConfigureServer({
    currentTeams,
    team,
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
        order = 0,
        index = NaN,
    } = team || {};

    const [transition, setTransition] = useState<'inFromRight' | 'outToLeft'>();
    const [name, setName] = useState(prevName || '');
    const [url, setUrl] = useState(prevURL || '');
    const [nameError, setNameError] = useState('');
    const [urlError, setURLError] = useState('');
    const [showContent, setShowContent] = useState(false);
    const [waiting, setWaiting] = useState(false);

    const canSave = name && url && !nameError && !urlError;

    useEffect(() => {
        setTransition('inFromRight');
        setShowContent(true);
    }, []);

    const checkProtocolInURL = (checkURL: string): Promise<string> => {
        if (urlUtils.startsWithProtocol(checkURL)) {
            return Promise.resolve(checkURL);
        }

        return new Promise((resolve) => {
            let eventCount = 0;

            const handler = (event: {data: {type: string; data: string | Error}}) => {
                let newURL = checkURL;

                if (event.data.type === PING_DOMAIN_RESPONSE) {
                    if (event.data.data instanceof Error) {
                        console.error(`Could not ping url: ${checkURL}`);
                    } else {
                        newURL = `${event.data.data}://${checkURL}`;
                        setUrl(newURL);
                    }

                    window.removeEventListener('message', handler);
                    resolve(newURL);
                } else if (eventCount >= 3) {
                    window.removeEventListener('message', handler);
                    resolve(newURL);
                }

                eventCount++;
            };

            window.addEventListener('message', handler);
            window.postMessage({type: PING_DOMAIN, data: checkURL}, window.location.href);
        });
    };

    const validateName = () => {
        const newName = name.trim();

        if (!newName) {
            return formatMessage({
                id: 'renderer.components.newTeamModal.error.nameRequired',
                defaultMessage: 'Name is required.',
            });
        }

        if (currentTeams.find(({name: existingName}) => existingName === newName)) {
            return formatMessage({
                id: 'renderer.components.newTeamModal.error.serverNameExists',
                defaultMessage: 'A server with the same name already exists.',
            });
        }

        return '';
    };

    const validateURL = async (fullURL: string) => {
        if (!fullURL) {
            return formatMessage({
                id: 'renderer.components.newTeamModal.error.urlRequired',
                defaultMessage: 'URL is required.',
            });
        }

        if (!urlUtils.startsWithProtocol(fullURL)) {
            return formatMessage({
                id: 'renderer.components.newTeamModal.error.urlNeedsHttp',
                defaultMessage: 'URL should start with http:// or https://.',
            });
        }

        if (!urlUtils.isValidURL(fullURL)) {
            return formatMessage({
                id: 'renderer.components.newTeamModal.error.urlIncorrectFormatting',
                defaultMessage: 'URL is not formatted correctly.',
            });
        }

        if (currentTeams.find(({url: existingURL}) => existingURL === fullURL)) {
            return formatMessage({
                id: 'renderer.components.newTeamModal.error.serverUrlExists',
                defaultMessage: 'A server with the same URL already exists.',
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

        const fullURL = await checkProtocolInURL(url.trim());
        const urlError = await validateURL(fullURL);

        if (urlError) {
            setTransition(undefined);
            setURLError(urlError);
            setWaiting(false);
            return;
        }

        setTransition('outToLeft');

        setTimeout(() => {
            onConnect({
                url: fullURL,
                name,
                index,
                order,
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
                                        customMessage={urlError ? ({
                                            type: STATUS.ERROR,
                                            value: urlError,
                                        }) : ({
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
