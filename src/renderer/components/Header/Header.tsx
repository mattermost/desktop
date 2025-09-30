// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Logo from 'renderer/components/Images/Logo';

import './Header.scss';

type HeaderProps = {
    alternateLink?: React.ReactElement;
}

const Header = ({
    alternateLink,
}: HeaderProps) => (
    <div
        className='Header'
    >
        <div className='Header__main'>
            <div className='Header__logo'>
                <Logo/>
            </div>
            {alternateLink}
        </div>
    </div>
);

export default Header;
