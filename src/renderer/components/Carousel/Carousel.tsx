// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useEffect, useRef} from 'react';

import CarouselButton, {ButtonDirection} from './CarouselButton';
import CarouselPaginationIndicator from './CarouselPaginationIndicator';

import 'renderer/css/components/Carousel.scss';

const AUTO_CHANGE_TIME = 5000;

type CarouselProps = {
    slides: Array<{key: string; content: React.ReactNode}>;
    startIndex?: number;
    darkMode?: boolean;
};

function Carousel({
    slides,
    startIndex = 0,
    darkMode = false,
}: CarouselProps) {
    const [slideIn, setSlideIn] = useState(startIndex);
    const [slideOut, setSlideOut] = useState(NaN);
    const [direction, setDirection] = useState(ButtonDirection.NEXT);
    const [autoChange, setAutoChange] = useState(true);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const disableNavigation = slides.length <= 1;

    useEffect(() => {
        timerRef.current = autoChange ? (
            setTimeout(() => {
                handleOnNextButtonClick(true);
            }, AUTO_CHANGE_TIME)
        ) : null;

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [slideIn, autoChange]);

    const handleOnPrevButtonClick = () => {
        moveSlide(slideIn - 1);
        setDirection(ButtonDirection.PREV);
        setAutoChange(false);
    };

    const handleOnNextButtonClick = (fromAuto?: boolean) => {
        moveSlide(slideIn + 1);
        setDirection(ButtonDirection.NEXT);

        if (!fromAuto) {
            setAutoChange(false);
        }
    };

    const handleOnPaginationIndicatorClick = (indicatorIndex: number) => {
        moveSlide(indicatorIndex);
        setDirection(indicatorIndex > slideIn ? ButtonDirection.NEXT : ButtonDirection.PREV);
        setAutoChange(false);
    };

    const moveSlide = (toIndex: number) => {
        if (toIndex === slideIn) {
            return;
        }

        let current = toIndex;

        if (toIndex < 0) {
            current = slides.length - 1;
        } else if (toIndex >= slides.length) {
            current = 0;
        }

        setSlideOut(slideIn);
        setSlideIn(current);
    };

    return (
        <div className='Carousel'>
            <div className='Carousel__slides'>
                {slides.map(({key, content}, slideIndex) => {
                    const isPrev = slideIndex === slideOut;
                    const isCurrent = slideIndex === slideIn;

                    return (
                        <div
                            key={key}
                            id={key}
                            className={classNames(
                                'Carousel__slide',
                                {
                                    'Carousel__slide-current': isCurrent,
                                    inFromRight: isCurrent && direction === ButtonDirection.NEXT,
                                    inFromLeft: isCurrent && direction === ButtonDirection.PREV,
                                    outToLeft: isPrev && direction === ButtonDirection.NEXT,
                                    outToRight: isPrev && direction === ButtonDirection.PREV,
                                },
                            )}
                        >
                            {content}
                        </div>
                    );
                })}
            </div>
            <div className='Carousel__pagination'>
                <CarouselButton
                    direction={ButtonDirection.PREV}
                    disabled={disableNavigation}
                    onClick={handleOnPrevButtonClick}
                />
                <CarouselPaginationIndicator
                    pages={slides.length}
                    activePage={slideIn}
                    disabled={disableNavigation}
                    darkMode={darkMode}
                    onClick={handleOnPaginationIndicatorClick}
                />
                <CarouselButton
                    direction={ButtonDirection.NEXT}
                    disabled={disableNavigation}
                    onClick={handleOnNextButtonClick}
                />
            </div>
        </div>
    );
}

export default Carousel;
