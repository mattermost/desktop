// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import 'renderer/css/components/Button.scss';
import 'renderer/css/components/CarouselButton.scss';

export enum ButtonDirection {
    NEXT = 'next',
    PREV = 'prev',
}

type CarouselButtonProps = {
    direction: ButtonDirection;
    disabled?: boolean;
    onClick?: () => void;
};

function CarouselButton({
    direction = ButtonDirection.NEXT,
    disabled = false,
    onClick = () => null,
}: CarouselButtonProps) {
    const handleOnClick = () => {
        onClick();
    };

    return (
        <button
            id={`${direction}CarouselButton`}
            className={classNames(
                'CarouselButton',
                'icon-button icon-button-small',
                {
                    disabled,
                },
            )}
            disabled={disabled}
            onClick={handleOnClick}
        >
            <i className={direction === ButtonDirection.PREV ? 'icon-chevron-left' : 'icon-chevron-right'}/>
        </button>
    );
}

export default CarouselButton;
