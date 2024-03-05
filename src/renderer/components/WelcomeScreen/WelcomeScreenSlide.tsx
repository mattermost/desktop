// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import 'renderer/css/components/WelcomeScreenSlide.scss';

type WelcomeScreenSlideProps = {
    title: string;
    subtitle: string | React.ReactElement;
    image: React.ReactNode;
    isMain?: boolean;
    darkMode?: boolean;
};

const WelcomeScreenSlide = ({
    title,
    subtitle,
    image,
    isMain,
    darkMode,
}: WelcomeScreenSlideProps) => (
    <div
        className={classNames(
            'WelcomeScreenSlide',
            {
                'WelcomeScreenSlide--main': isMain,
                'WelcomeScreenSlide--darkMode': darkMode,
            },
        )}
    >
        <div className='WelcomeScreenSlide__image'>
            {image}
        </div>
        <div className='WelcomeScreenSlide__title'>
            {title}
        </div>
        <div className='WelcomeScreenSlide__subtitle'>
            {subtitle}
        </div>
    </div>
);

export default WelcomeScreenSlide;
