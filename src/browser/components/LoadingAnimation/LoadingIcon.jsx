// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

function LoadingAnimation() {
  return (
    <svg
      width='120'
      height='120'
      viewBox='0 0 120 120'
      xmlns='http://www.w3.org/2000/svg'
    >
      <defs>
        <linearGradient
          id='LoadingAnimation__spinner-gradient'
          x1='00%'
          y1='80px'
          x2='0%'
          y2='40px'
          gradientUnits='userSpaceOnUse'
        >
          <stop
            offset='0'
            className='LoadingAnimation__spinner-gradient-color'
            stopOpacity='1'
          />
          <stop
            offset='1'
            className='LoadingAnimation__spinner-gradient-color'
            stopOpacity='0'
          />
        </linearGradient>
        <mask id='LoadingAnimation__base-wipe-mask'>
          <rect
            x='0'
            y='0'
            width='120'
            height='120'
            fill='white'
          />
          <g className='LoadingAnimation__compass-base-mask-container'>
            <circle
              className='LoadingAnimation__compass-base-mask'
              r='31'
              cx='60'
              cy='60'
              fill='white'
              stroke='black'
              strokeWidth='62'
            />
          </g>
        </mask>
        <mask id='LoadingAnimation__base-mask'>
          <rect
            x='0'
            y='0'
            width='120'
            height='120'
            fill='white'
          />
          <circle
            r='43'
            cx='62'
            cy='53'
            fill='black'
          />
          <g className='LoadingAnimation__compass-needle-behind-mask'>
            <g transform='translate(62,53)'>
              <g transform='translate(-32, -94)'>
                <path
                  d='M36.346 36.841L64 0.855972V95.519L63.996 95.518C63.719 112.941 49.488 127 32 127C14.339 127 0 112.661 0 95C0 87.856 2.346 81.256 6.309 75.928L6.918 75.135L36.057 37.218C36.151 37.091 36.248 36.965 36.346 36.841Z'
                  fill='black'
                />
              </g>
            </g>
          </g>
          <g className='LoadingAnimation__compass-needle-front-mask'>
            <g transform='translate(62,53)'>
              <g transform='translate(-32, -94)'>
                <path
                  d='M36.346 36.841L64 0.855972V95.519L63.996 95.518C63.719 112.941 49.488 127 32 127C14.339 127 0 112.661 0 95C0 87.856 2.346 81.256 6.309 75.928L6.918 75.135L36.057 37.218C36.151 37.091 36.248 36.965 36.346 36.841Z'
                  fill='black'
                />
              </g>
            </g>
          </g>
        </mask>
        <mask id='LoadingAnimation__spinner-left-half-mask'>
          <rect
            x='0'
            y='0'
            width='60'
            height='120'
            fill='white'
          />
          <circle
            className='LoadingAnimation__spinner-mask'
            r='20'
            cx='60'
            cy='60'
            fill='black'
          />
        </mask>
        <mask id='LoadingAnimation__spinner-right-half-mask'>
          <rect
            x='60'
            y='0'
            width='120'
            height='120'
            fill='white'
          />
          <circle
            className='LoadingAnimation__spinner-mask'
            r='20'
            cx='60'
            cy='60'
            fill='black'
          />
        </mask>
        <mask id='LoadingAnimation__spinner-wipe-mask'>
          <rect
            x='0'
            y='0'
            width='120'
            height='120'
            fill='white'
          />
          <g className='LoadingAnimation__spinner-mask-container'>
            <circle
              className='LoadingAnimation__spinner-mask'
              r='31'
              cx='60'
              cy='60'
              fill='black'
              stroke='white'
              strokeWidth='62'
            />
          </g>
        </mask>
      </defs>
      <g
        className='LoadingAnimation__spinner-container'
        mask='url(#LoadingAnimation__spinner-wipe-mask)'
      >
        <g className='LoadingAnimation__spinner'>
          <circle
            r='25'
            cx='60'
            cy='60'
            fill='currentColor'
            mask='url(#LoadingAnimation__spinner-left-half-mask)'
          />
          <circle
            r='25'
            cx='60'
            cy='60'
            fill='url(#LoadingAnimation__spinner-gradient)'
            mask='url(#LoadingAnimation__spinner-right-half-mask)'
          />
        </g>
      </g>
      <g className='LoadingAnimation__compass'>
        <g
          className='LoadingAnimation__compass-base-container'
          mask='url(#LoadingAnimation__base-wipe-mask)'
        >
          <circle
            className='LoadingAnimation__compass-base'
            r='60'
            cx='60'
            cy='60'
            fill='currentColor'
            mask='url(#LoadingAnimation__base-mask)'
          />
        </g>
        <g className='LoadingAnimation__compass-needle-container'>
          <g className='LoadingAnimation__compass-needle'>
            <g transform='translate(62,53)'>
              <g transform='translate(-18, -50)'>
                <path
                  d='M33.312 0.584182C33.587 0.229182 34.017 0.000181675 34.5 0.000181675C35.327 0.000181675 35.998 0.671182 36 1.49718L35.998 49.7092C35.999 49.8052 36 49.9032 36 50.0002C36 50.0972 35.999 50.1952 35.998 50.2932C35.842 60.0922 27.837 68.0002 18 68.0002C8.06602 68.0002 1.52588e-05 59.9342 1.52588e-05 50.0002C1.52588e-05 45.9792 1.32202 42.2632 3.55402 39.2652L3.55502 39.2642C3.66702 39.1132 3.78202 38.9642 3.90002 38.8162L33.309 0.589182L33.312 0.584182Z'
                  fill='currentColor'
                />
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

export default LoadingAnimation;
