// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import './WelcomeScreenSlide.scss';

type WelcomeScreenSlideProps = {
    title: string;
    subtitle: string | React.ReactElement;
    image: React.ReactNode;
    isMain?: boolean;
};

const WelcomeScreenSlide = ({
    title,
    subtitle,
    image,
    isMain,
}: WelcomeScreenSlideProps) => (
    <div
        className={classNames(
            'WelcomeScreenSlide',
            {
                'WelcomeScreenSlide--main': isMain,
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
