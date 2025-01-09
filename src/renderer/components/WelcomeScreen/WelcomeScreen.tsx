// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useEffect, useMemo} from 'react';
import {useIntl, FormattedMessage} from 'react-intl';

import {MODAL_TRANSITION_TIMEOUT} from 'common/utils/constants';
import Carousel from 'renderer/components/Carousel';
import Header from 'renderer/components/Header';
import CallsImage from 'renderer/components/Images/calls';
import CollaborateImage from 'renderer/components/Images/collaborate';
import ThreadsEmptyImage from 'renderer/components/Images/threads-empty';
import ToolsImage from 'renderer/components/Images/tools';
import LoadingBackground from 'renderer/components/LoadingScreen/LoadingBackground';

import WelcomeScreenSlide from './WelcomeScreenSlide';

import 'renderer/css/components/Button.scss';
import 'renderer/css/components/WelcomeScreen.scss';
import 'renderer/css/components/LoadingScreen.css';

type WelcomeScreenProps = {
    darkMode?: boolean;
    onGetStarted?: () => void;
};

function WelcomeScreen({
    darkMode = false,
    onGetStarted = () => null,
}: WelcomeScreenProps) {
    const {formatMessage} = useIntl();

    const [transition, setTransition] = useState<'outToLeft'>();
    const [showContent, setShowContent] = useState(false);

    useEffect(() => {
        setShowContent(true);
    }, []);

    const slides = useMemo(() => [
        {
            key: 'welcome',
            title: formatMessage({id: 'renderer.components.welcomeScreen.slides.welcome.title', defaultMessage: 'Welcome'}),
            subtitle: formatMessage({
                id: 'renderer.components.welcomeScreen.slides.welcome.subtitle',
                defaultMessage: 'Mattermost is an open source collaboration platform for mission-critical work. Secure, flexible, and integrated with the tools you love.',
            }),
            image: (
                <ThreadsEmptyImage/>
            ),
            main: true,
        },
        {
            key: 'Collaborate in real-time',
            title: formatMessage({id: 'renderer.components.welcomeScreen.slides.collaborate.title', defaultMessage: 'Collaborate in real-time'}),
            subtitle: (
                <FormattedMessage
                    id='renderer.components.welcomeScreen.slides.collaborate.subtitle'
                    defaultMessage='Collaborate effectively with persistent channels, file and code snippet sharing, and workflow automation purpose-built for technical teams.'
                    values={{
                        br: (x: React.ReactNode) => (<><br/>{x}</>),
                    }}
                />
            ),
            image: (
                <CollaborateImage/>
            ),
        },
        {
            key: 'calls',
            title: formatMessage({id: 'renderer.components.welcomeScreen.slides.calls.title', defaultMessage: 'Start secure calls instantly'}),
            subtitle: formatMessage({
                id: 'renderer.components.welcomeScreen.slides.calls.subtitle',
                defaultMessage: 'When typing isn’t fast enough, seamlessly move from chat to audio calls and screenshare without switching tools.',
            }),
            image: (
                <CallsImage/>
            ),
        },
        {
            key: 'integrate',
            title: formatMessage({id: 'renderer.components.welcomeScreen.slides.integrate.title', defaultMessage: 'Integrate with tools you love'}),
            subtitle: formatMessage({
                id: 'renderer.components.welcomeScreen.slides.integrate.subtitle',
                defaultMessage: 'Execute and automate workflows with flexible, custom integrations with popular technical tools like GitHub, GitLab, and ServiceNow.',
            }),
            image: (
                <ToolsImage/>
            ),
        },
    ], [formatMessage]);

    const handleOnGetStartedClick = () => {
        setTransition('outToLeft');

        setTimeout(() => {
            onGetStarted();
        }, MODAL_TRANSITION_TIMEOUT);
    };

    return (
        <div
            className={classNames(
                'LoadingScreen',
                {'LoadingScreen--darkMode': darkMode},
                'WelcomeScreen',
            )}
        >
            <LoadingBackground/>
            <Header darkMode={darkMode}/>
            {showContent && (
                <div className={classNames('WelcomeScreen__body', transition)}>
                    <div className='WelcomeScreen__content'>
                        <Carousel
                            slides={slides.map(({key, title, subtitle, image, main}) => ({
                                key,
                                content: (
                                    <WelcomeScreenSlide
                                        key={key}
                                        title={title}
                                        subtitle={subtitle}
                                        image={image}
                                        isMain={main}
                                        darkMode={darkMode}
                                    />
                                ),
                            }))}
                            darkMode={darkMode}
                        />
                        <button
                            id='getStartedWelcomeScreen'
                            className={classNames(
                                'WelcomeScreen__button',
                                'primary-button primary-medium-button',
                            )}
                            onClick={handleOnGetStartedClick}
                        >
                            {formatMessage({id: 'renderer.components.welcomeScreen.button.getStarted', defaultMessage: 'Get Started'})}
                        </button>
                    </div>
                </div>
            )}
            <div className='WelcomeScreen__footer'/>
        </div>
    );
}

export default WelcomeScreen;
