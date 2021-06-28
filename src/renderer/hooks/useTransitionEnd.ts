// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

/**
 * A custom hook to implement a transitionend listener on the provided ref
 * @param {object} ref - A reference to a DOM element to add the listener to
 * @param {function} callback - A callback function that will be run for matching animation events
 * @param {array} properties - An array of css property strings to listen for
 * @param {boolean} listenForEventBubbling - A parameter that when true, listens for events on the target element and
 *   bubbled from all descendent elements but when false, only listens for events coming from the target element and
 *   ignores events bubbling up from descendent elements
 */
function useTransitionend<T extends Element>(
    ref: React.RefObject<T>,
    callback: (event: Event) => void,
    properties: string[],
    listenForEventBubbling = true,
) {
    React.useEffect(() => {
        if (!ref.current) {
            return undefined;
        }

        function handleTransitionEnd(event: Event & {propertyName?: string}) {
            if (!listenForEventBubbling && event.target !== ref.current) {
                return;
            }

            if (properties && typeof properties === 'object') {
                const property = properties.find(
                    (propertyName) => propertyName === event.propertyName,
                );
                if (property) {
                    callback(event);
                }
                return;
            }
            callback(event);
        }

        ref.current.addEventListener('transitionend', handleTransitionEnd);

        return () => {
            if (!ref.current) {
                return;
            }
            ref.current.removeEventListener(
                'transitionend',
                handleTransitionEnd,
            );
        };
    }, [ref, callback, properties, listenForEventBubbling]);
}

export default useTransitionend;
