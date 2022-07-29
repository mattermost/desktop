// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import classNames from 'classnames';

import 'renderer/css/components/Button.scss';
import 'renderer/css/components/CarouselPaginationIndicator.scss';

type CarouselPaginationIndicatorProps = {
    pages: number;
    activePage: number;
    disabled?: boolean;
    darkMode?: boolean;
    onClick?: (pageIndex: number) => void;
};

function CarouselPaginationIndicator({
    pages,
    activePage,
    disabled,
    darkMode,
    onClick = () => null,
}: CarouselPaginationIndicatorProps) {
    const handleOnClick = useCallback((pageIndex: number) => () => {
        onClick(pageIndex);
    }, [onClick]);

    const getIndicators = useCallback(() => {
        const indicators = [];

        for (let pageIndex = 0; pageIndex < pages; pageIndex++) {
            indicators.push(
                <div
                    key={pageIndex}
                    onClick={handleOnClick(pageIndex)}
                    className={classNames(
                        'indicatorDot',
                        {
                            'indicatorDot-inverted': darkMode,
                            active: activePage === pageIndex,
                            disabled,
                        },
                    )}
                >
                    <div className='dot'/>
                </div>,
            );
        }

        return indicators;
    }, [pages, activePage, darkMode, handleOnClick]);

    return (
        <div className='CarouselPaginationIndicator'>
            {getIndicators()}
        </div>
    );
}

export default CarouselPaginationIndicator;
