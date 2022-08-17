// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {useIntl, FormattedMessage} from 'react-intl';
import classNames from 'classnames';

import bullseye from 'renderer/assets/svg/bullseye.svg';
import channels from 'renderer/assets/svg/channels.svg';
import chat2 from 'renderer/assets/svg/chat2.svg';
import clipboard from 'renderer/assets/svg/clipboard.svg';

import Carousel from 'renderer/components/Carousel';
import Header from 'renderer/components/Header';
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

    const slides = useMemo(() => [
        {
            key: 'welcome',
            title: formatMessage({id: 'renderer.components.welcomeScreen.slides.welcome.title', defaultMessage: 'Welcome'}),
            subtitle: formatMessage({
                id: 'renderer.components.welcomeScreen.slides.welcome.subtitle',
                defaultMessage: 'Mattermost is an open source platform for developer collaboration. Secure, flexible, and integrated with the tools you love.',
            }),
            image: (
                <img
                    src={chat2}
                    draggable={false}
                />
            ),
            main: true,
        },
        {
            key: 'channels',
            title: formatMessage({id: 'renderer.components.welcomeScreen.slides.channels.title', defaultMessage: 'Channels'}),
            subtitle: (
                <FormattedMessage
                    id='renderer.components.welcomeScreen.slides.channels.subtitle'
                    defaultMessage='All of your team’s communication in one place.<br></br>Secure collaboration, built for developers.'
                    values={{
                        br: (x: React.ReactNode) => (<><br/>{x}</>),
                    }}
                />
            ),
            image: (
                <img
                    src={channels}
                    draggable={false}
                />
            ),
        },
        {
            key: 'playbooks',
            title: formatMessage({id: 'renderer.components.welcomeScreen.slides.playbooks.title', defaultMessage: 'Playbooks'}),
            subtitle: formatMessage({
                id: 'renderer.components.welcomeScreen.slides.palybooks.subtitle',
                defaultMessage: 'Move faster and make fewer mistakes with checklists, automations, and tool integrations that power your team’s workflows.',
            }),
            image: (
                <img
                    src={clipboard}
                    draggable={false}
                />
            ),
        },
        {
            key: 'boards',
            title: formatMessage({id: 'renderer.components.welcomeScreen.slides.boards.title', defaultMessage: 'Boards'}),
            subtitle: formatMessage({
                id: 'renderer.components.welcomeScreen.slides.boards.subtitle',
                defaultMessage: 'Ship on time, every time, with a project and task management solution built for digital operations.',
            }),
            image: (
                <img
                    src={bullseye}
                    draggable={false}
                />
            ),
        },
    ], []);

    const handleOnGetStartedClick = () => {
        onGetStarted();
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
            <div className='WelcomeScreen__body'>
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
                            {'primary-button-inverted': darkMode},
                        )}
                        onClick={handleOnGetStartedClick}
                    >
                        {formatMessage({id: 'renderer.components.welcomeScreen.button.getStarted', defaultMessage: 'Get Started'})}
                    </button>
                </div>
            </div>
            <div className='WelcomeScreen__footer'/>
        </div>
    );
}

export default WelcomeScreen;
