// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import StippleMask from 'renderer/assets/StippleMask.jpg';

function LoadingBackground() {
    return (
        <div className='LoadingScreen__backgound'>
            <svg
                viewBox='0 0 1366 728'
                xmlns='http://www.w3.org/2000/svg'
                preserveAspectRatio='xMidYMid slice'
            >
                <g style={{transform: 'translate(676px, -200px)'}}>
                    <g style={{transformOrigin: '450px 267.5px', transform: 'rotate(45deg)'}}>
                        <use href='#pill'/>
                    </g>
                </g>
                <g style={{transform: 'translate(125px, 0px)'}}>
                    <g style={{transformOrigin: '450px 267.5px', transform: 'rotate(-135deg)'}}>
                        <use href='#pill'/>
                    </g>
                </g>
                <g style={{transform: 'translate(700px, 330px)'}}>
                    <g style={{transformOrigin: '450px 267.5px', transform: 'rotate(-135deg)'}}>
                        <use href='#pill'/>
                    </g>
                </g>
                <g style={{transform: 'translate(-280px, 190px)'}}>
                    <g style={{transformOrigin: '450px 267.5px', transform: 'rotate(45deg)'}}>
                        <use href='#pill'/>
                    </g>
                </g>
                <defs>
                    <mask id='stippleMask'>
                        <image
                            width='900'
                            height='535'
                            href={StippleMask}
                        />
                    </mask>
                    <g
                        id='pill'
                        className='Pill'
                    >
                        <rect
                            className='Pill__stipple'
                            x='0'
                            y='0'
                            width='900'
                            height='535'
                            mask='url(#stippleMask)'
                        />
                        <path
                            className='Pill__shape'
                            d='M600 40H0V490H600C724.264 490 825 389.264 825 265C825 140.736 724.264 40 600 40Z'
                            fill='url(#pillGradient)'
                        />
                    </g>
                    <linearGradient id='pillGradient'>
                        <stop
                            className='Pill__gradient'
                            offset='20%'
                            stopOpacity='1'
                        />
                        <stop
                            className='Pill__gradientHighlight'
                            offset='95%'
                            stopOpacity='1'
                        />
                    </linearGradient>
                </defs>
            </svg>
        </div>
    );
}

export default LoadingBackground;
