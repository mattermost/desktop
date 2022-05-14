// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const NoValue = Symbol('represents absence of any value');

/** throttles a function, so that it is called at most every t milliseconds */
export function throttle<T>(f: (x: T) => any, t: number): (x: T) => any {
    let nextValue: T | typeof NoValue = NoValue;
    let id: ReturnType<typeof setTimeout> | undefined;
    return (function throttle(x: T): void {
        if (id) {
            nextValue = x;
        } else {
            nextValue = NoValue;
            id = setTimeout(() => {
                if (nextValue !== NoValue) {
                    f(nextValue as T);
                }
                id = undefined;
            }, t);
            f(x);
        }
    });
}

/** debounces a function, so that it is called only once after at least t milliseconds */
export function debounce<T>(f: (x: T) => any, t: number): (x: T) => any {
    let id: ReturnType<typeof setTimeout> | undefined;
    return (function debounce(x: T): void {
        if (id) {
            clearTimeout(id);
            id = undefined;
        }
        id = setTimeout(() => {
            f(x);
            id = undefined;
        }, t);
    });
}
