// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {throttle} from 'underscore';

import ding from '../assets/sounds/ding.mp3';
import bing from '../assets/sounds/bing.mp3';
import crackle from '../assets/sounds/crackle.mp3';
import down from '../assets/sounds/down.mp3';
import hello from '../assets/sounds/hello.mp3';
import ripple from '../assets/sounds/ripple.mp3';
import upstairs from '../assets/sounds/upstairs.mp3';

export const DEFAULT_WIN7 = 'Ding';
const notificationSounds = new Map([
    [DEFAULT_WIN7, ding],
    ['Bing', bing],
    ['Crackle', crackle],
    ['Down', down],
    ['Hello', hello],
    ['Ripple', ripple],
    ['Upstairs', upstairs],
]);

export const playSound = throttle((soundName) => {
    if (soundName) {
        const audio = new Audio(notificationSounds.get(soundName));
        audio.play();
    }
}, 3000, {trailing: false});
