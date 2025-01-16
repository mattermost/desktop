// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback} from 'react';

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

    const handleOnKeyDown = useCallback((pageIndex: number) => (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            onClick(pageIndex);
        }
    }, [onClick]);

    const getIndicators = useCallback(() => {
        const indicators = [];

        for (let pageIndex = 0; pageIndex < pages; pageIndex++) {
            indicators.push(
                <div
                    key={pageIndex}
                    id={`PaginationIndicator${pageIndex}`}
                    onClick={handleOnClick(pageIndex)}
                    onKeyDown={handleOnKeyDown(pageIndex)}
                    className={classNames(
                        'indicatorDot',
                        {
                            active: activePage === pageIndex,
                            disabled,
                        },
                    )}
                    role='button'
                    tabIndex={0}
                >
                    <div className='dot'/>
                </div>,
            );
        }

        return indicators;
    }, [pages, activePage, darkMode, handleOnClick]);

    return (
        <div
            className='CarouselPaginationIndicator'
            tabIndex={-1}
        >
            {getIndicators()}
        </div>
    );
}

export default CarouselPaginationIndicator;
