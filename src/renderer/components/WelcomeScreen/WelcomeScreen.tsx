// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useEffect, useMemo} from 'react';
import {useIntl} from 'react-intl';

import {MODAL_TRANSITION_TIMEOUT} from 'common/utils/constants';
import Carousel from 'renderer/components/Carousel';
import Header from 'renderer/components/Header';
import BackgroundImage from 'renderer/components/Images/background';
import CallsImage from 'renderer/components/Images/calls';
import CollaborateImage from 'renderer/components/Images/collaborate';
import ThreadsEmptyImage from 'renderer/components/Images/threads-empty';
import ToolsImage from 'renderer/components/Images/tools';
import WelcomeScreenSlide from 'renderer/components/WelcomeScreen/WelcomeScreenSlide';

import 'renderer/css/components/Button.scss';
import './WelcomeScreen.scss';
import 'renderer/components/LoadingScreen/LoadingScreen.scss';

type WelcomeScreenProps = {
    onGetStarted?: () => void;
};

function WelcomeScreen({
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
                defaultMessage: 'Mattermost is a sovereign collaboration platform, purpose-built for operational environments. Secure by design.',
            }),
            image: (
                <ThreadsEmptyImage/>
            ),
            main: true,
        },
        {
            key: 'Collaborate in real-time',
            title: formatMessage({id: 'renderer.components.welcomeScreen.slides.collaborate.title', defaultMessage: 'Collaborate in real-time'}),
            subtitle: formatMessage({
                id: 'renderer.components.welcomeScreen.slides.collaborate.subtitle',
                defaultMessage: 'Coordinate across teams with persistent mission channels, secure file sharing, and automated workflows.',
            }),
            image: (
                <CollaborateImage/>
            ),
        },
        {
            key: 'calls',
            title: formatMessage({id: 'renderer.components.welcomeScreen.slides.calls.title', defaultMessage: 'Start secure calls instantly'}),
            subtitle: formatMessage({
                id: 'renderer.components.welcomeScreen.slides.calls.subtitle',
                defaultMessage: 'Seamlessly move from chat to audio calls and screen sharing without switching tools or losing context.',
            }),
            image: (
                <CallsImage/>
            ),
        },
        {
            key: 'integrate',
            title: formatMessage({id: 'renderer.components.welcomeScreen.slides.integrate.title', defaultMessage: 'Integrate with your systems'}),
            subtitle: formatMessage({
                id: 'renderer.components.welcomeScreen.slides.integrate.subtitle',
                defaultMessage: 'Integrate with the tools and systems powering your operations — ticketing, conferencing, alerting, or custom integrations.',
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
            className='LoadingScreen WelcomeScreen'
        >
            <BackgroundImage/>
            <Header/>
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
                                    />
                                ),
                            }))}
                        />
                        <button
                            id='getStartedWelcomeScreen'
                            className={classNames(
                                'WelcomeScreen__button',
                                'primary-button primary-medium-button',
                            )}
                            onClick={handleOnGetStartedClick}
                        >
                            {formatMessage({id: 'renderer.components.welcomeScreen.button.getStarted', defaultMessage: 'Get started'})}
                        </button>
                    </div>
                </div>
            )}
            <div className='WelcomeScreen__footer'/>
        </div>
    );
}

export default WelcomeScreen;
